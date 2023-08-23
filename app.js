require("dotenv").config();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const app = express();
const http = require("http");
const socketIo = require('socket.io');
const cors = require("cors");

const port = process.env.PORT || 3000;
var warningMessage = "Please login to start shopping"
var warningMessageRegister = "";

app.use(bodyParser.urlencoded({extended : true}));
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(session({
	secret : process.env.SECRETS,
	resave : false,
	saveUninitialized : false,
}));
app.use(passport.initialize());
app.use(passport.session());

const cartData = new mongoose.Schema({
	class_id: Number,
	name: String,
	quantity: String
}, { collection: 'cart1' });

const shoppingListItemSchema = new mongoose.Schema({
	shoppingListItem: String
});

const userSchema = new mongoose.Schema({
	email: String,
	password: String,
	shoppingList: [shoppingListItemSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const ShoppingListItem = new mongoose.model("ShoppingListItem", shoppingListItemSchema);
const User = new mongoose.model("User", userSchema);
const Item = new mongoose.model("cart1", cartData);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

mongoose.connect("mongodb+srv://smartcart:" + process.env.CARTDATA + "@cluster0.wmyheb4.mongodb.net/cartData")
	.then(() => {
		console.log("Connected to SmartCartDB");

		const server = http.createServer(app);

		const io = socketIo(server);

		server.listen(port, () => {
			console.log("App server is running on port: " + port);
		});

		app.get("/", (req, res)=>{
			res.render("index", {
				warningMessage : warningMessage
			});
			warningMessage = "Please Login to start shopping";
		});
		
		app.get("/register", (req, res)=>{
			res.render("register", {
				warningMessageRegister : warningMessageRegister
			});
			warningMessageRegister = "";
		});
		
		app.get("/secrets", function(req, res){
			warningMessage = "Please login to start shopping";
			if (req.isAuthenticated()){
				User.find({username : req.session.passport.user}).then(foundUser => {
					Item.find().then(foundItem => {
						console.log(foundItem);
						res.render("secrets", {
							user : foundUser[0],
							shoppingCart : foundItem
						});
					});
				});
			} else {
				warningMessage = "Please login to start shopping"
				res.redirect("/");
			}
		});
		
		
		app.post("/register", function(req, res){
			User.register({username : req.body.username}, req.body.password, function(err, user){
				if (err){
					console.log(err);
					warningMessageRegister = "A user with that name already exists";
					res.redirect("/register");
				} else {
					passport.authenticate("local", {failureRedirect : '/register', failureMessage : true})(req, res, function(){ //create session for user essentially (????)
						warningMessage = "You have been registered Successfully! Please login to continue";
						res.redirect("/");
					});
				}
			});
		
		});
		
		app.post("/login", (req, res)=>{
			const newUser = new User;
			newUser.username = req.body.username;
			newUser.password = req.body.password;
			req.login(newUser, function(err){
				if (err){
					console.log(err);
				} else {
					warningMessage = "Invalid username / password."
					passport.authenticate("local", {failureRedirect: '/', failureMessage: "failed to authenticate"})(req, res, function(){
						res.redirect("/secrets");
					});
					// warningMessage = "";
				}
			}) //login() comes from passport
		});
		
		app.post("/addItemToShoppingList", (req, res)=>{
			// console.log("new item added is " + req.body.shoppingListItem);
			User.findOneAndUpdate({username : req.session.passport.user}, {}).then(foundUser => {
				const shoppingListItemX = new ShoppingListItem;
				shoppingListItemX.shoppingListItem = req.body.shoppingListItem;
				// shoppingListItemX.save();
				foundUser.shoppingList.push(shoppingListItemX);
				foundUser.save();
			});
			res.redirect("/secrets");
		});
		
		app.post("/deleteShoppingListItem", (req, res)=>{
			User.findOneAndUpdate({username : req.session.passport.user}, {}).then(foundUser => {
				var index = 0;
				for (i = 0; i < foundUser.shoppingList.length; i++){
					if (foundUser.shoppingList[i]._id == req.body.deleteShoppingListItemID){
						index = i;
					}
					else {
						// console.log("Object not found?????");
					}
				}
				// console.log(index);
				foundUser.shoppingList.splice(index, 1);
				foundUser.save();
				res.redirect("/secrets");
			});
			
		});
		
		app.post("/deleteShoppingCartItem", (req, res)=>{
			async function deleteShoppingCartItem(){
				await Item.deleteOne({_id : req.body.deleteItemID});
			}
		
			deleteShoppingCartItem();
			res.redirect("/secrets");
		});
		app.get("/showShoppingCart", (req, res) => {
			Item.find().then(foundItem => {
				res.render("showCartData", {
					items: foundItem
				});
			});
		});

		Item.watch([{ $match: {operationType: {$in: ['insert']}}}]).on('change', (change) => {
			io.emit('databaseInsert', change);
		});
		Item.watch([{ $match: {operationType: {$in: ['update']}}}], { fullDocument: "updateLookup"}).on('change', (change) => {
			io.emit('databaseUpdate', change);
		});
	})
	.catch((err) => {
		console.log("Failed to connect to DB");
		console.log(err);
	});