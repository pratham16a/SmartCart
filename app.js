require("dotenv").config();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const app = express();

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

mongoose.connect("mongodb+srv://vyommkapur:"+ process.env.ATLASPSWD +"@cluster0.gvhgcxt.mongodb.net/SmartCartDB");
connectionPromise = mongoose.connection.asPromise();
connectionPromise.then(()=>{
	console.log("connected to SmartCartDB");
	app.listen(port, function(){
		console.log("listening on port : " + port);
	});
}).catch(()=>{
	console.log("failed to connect to DB");
});

const shoppingListItemSchema = new mongoose.Schema({
	shoppingListItem : String
});

const userSchema = new mongoose.Schema({
	email : String,
	password : String,
	shoppingList : [shoppingListItemSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const ShoppingListItem = new mongoose.model("ShoppingListItem" , shoppingListItemSchema);
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

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
			res.render("secrets", {
				user : foundUser[0]
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

