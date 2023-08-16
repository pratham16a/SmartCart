require("dotenv").config();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const port = process.env.PORT || 3000;
const app = express();



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

mongoose.connect("mongodb://127.0.0.1:27017/SmartCartDB");
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
	res.render("index");
});

app.get("/register", (req, res)=>{
	res.render("register")
});

app.get("/secrets", function(req, res){
	if (req.isAuthenticated()){
		User.find({username : req.session.passport.user}).then(foundUser => {
			console.log(foundUser[0].shoppingList);
			res.render("secrets", {
				user : foundUser[0]
			});
		});
	} else {
		res.redirect("/");
	}
});


app.post("/register", function(req, res){
	User.register({username : req.body.username}, req.body.password, function(err, user){
		if (err){
			console.log(err);
			res.redirect("/register");
		} else {
			passport.authenticate("local")(req, res, function(){ //create session for user essentially (????)
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
			passport.authenticate("local")(req, res, function(){
				res.redirect("/secrets");
			});
		}
	}) //login() comes from passport
});

app.post("/addItemToShoppingList", (req, res)=>{
	console.log("new item added is " + req.body.shoppingListItem);
	User.findOneAndUpdate({username : req.session.passport.user}, {}).then(foundUser => {
		const shoppingListItemX = new ShoppingListItem;
		shoppingListItemX.shoppingListItem = req.body.shoppingListItem;
		shoppingListItemX.save();
		foundUser.shoppingList.push(shoppingListItemX);
		foundUser.save();
	});
	res.redirect("/secrets");
});

