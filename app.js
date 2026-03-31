const express = require("express");
const path = require("path");
const {check, validationResult} = require('express-validator');
const mongoose = require("mongoose");

const Order = mongoose.model("Order", {
    name: String,
    email: String,
    phone: String,
    postcode: String,
    lunch: String,
    tickets: Number,
    campus: String,
    sub: Number,
    tax: Number,
    total: Number
});

const app = express();

// Connection caching for serverless
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    await mongoose.connect("mongodb+srv://alexbadila:Yo3kpaxy@cluster0.bwb3wky.mongodb.net/CollegeOrder");
    isConnected = true;
}

app.use(express.urlencoded({extended: false}));
app.set("views", path.join(__dirname, "views"));
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
    res.render("form");
});

app.post("/processForm", [
    check("name", "Name is empty").notEmpty(),
    check("email", "Not a valid email").isEmail(),
    check("tickets", "Ticket not selected").notEmpty().custom(value => {
        if(isNaN(value)) {
            throw Error("This is not a number");
        } else if(value <= 0) {
            throw Error("Not a positive number");
        } else {
            return true;
        }
    }),
    check("campus", "Campus not selected").notEmpty(),
    check("lunch", "Select yes/no for lunch").notEmpty(),
    check("postcode", "Invalid Post Code Format").matches(/^[a-zA-Z]\d[a-zA-Z]\s\d[a-zA-Z]\d$/),
    check("phone", "Invalid phone number").matches(/^\d{3}(\s|-)\d{3}(\s|-)\d{4}$/),
    check("lunch").custom((value, {req}) => {
        if(typeof(value) !== "undefined") {
            if(value === "yes" && req.body.tickets < 3) {
                throw Error("When lunch === yes buy 3 or more tickets")
            }
        } else {
            throw Error("Lunch selection (yes/no) not completed")
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if(errors.isEmpty()) {
        let name = req.body.name;
        let email = req.body.email;
        let campus = req.body.campus;
        let tickets = req.body.tickets;
        let lunch = req.body.lunch;
        var lunch_index = -1;
        let tax, total;

        for(var i = 0; i < lunch.length; i++){
            if(lunch[i].checked){
                lunch_index = i;
                break;
            }
        }
        if(lunch_index > -1){
            lunch = lunch[lunch_index].value;
        }

        var cost = 0;
        if(tickets > 0){ cost = 100 * tickets; }
        if(lunch == 'yes'){ cost += 60; }

        tax = cost * 0.13;
        total = cost + tax;

        let receipt = {
            "name": name,
            "email": email,
            "lunch": lunch,
            "campus": campus,
            "sub": cost.toFixed(2),
            "tax": tax.toFixed(2),
            "total": total.toFixed(2)
        }

        await connectDB(); // ← connect before DB operations
        let newOrder = new Order({
            name: receipt.name,
            email: receipt.email,
            phone: req.body.phone,
            postcode: req.body.postcode,
            lunch: receipt.lunch,
            tickets: tickets,
            campus: receipt.campus,
            sub: receipt.sub,
            tax: receipt.tax,
            total: receipt.total
        });

        newOrder.save().then(data => {
            res.render("form", {recpt: data});
        }).catch(err => {
            console.log("Data Saving Error!!!");
        });

    } else {
        res.render("form", {errors: errors.array()});
    }
});

app.get("/allOrders", async (req, res) => {
    await connectDB(); // ← connect before DB operations
    Order.find({}).then(data => {
        res.render("orders", {data: data});
    }).catch(err => {
        console.log("Data read error");
    });
});

// Export for Vercel
module.exports = app;

// Only listen when running locally
if (process.env.NODE_ENV !== "production") {
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}