const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const shortid = require('shortid');
const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )
app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//Set up models///////////////////////////////////////////////////////
var schema = new mongoose.Schema({
    user: {
    type: String,
    required: true
  },
    _id: {
      type: String,
      default: shortid.generate
    }
  
  });

var exerciseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  description: {
     type: String,
     required: true    
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: String
    //default: new Date()
  }
});
let userModel = mongoose.model('userModel', schema);
let exerciseModel = mongoose.model('exerciseModel', exerciseSchema);

//Save user if not found on submit/////////////////////////////////////
app.post("/api/exercise/new-user", function(req, res, next) {
  //search if username exists in databse
  let inputName = req.body.username;
  let item = ({
    user : inputName
  });
  userModel.findOne(item, function(err, result) {
    if(err) {return next()};
    //save result if the entered name is not found
    if(result == null) {
      let saveItem = new userModel({
    user : inputName
      
  });
      saveItem.save(function (err, product) {
        if(err) {return next()};
        return res.json({"username": product.user, "id": product["_id"]});
      });      
    } else {
      return res.send("Username already exists!");
    }    
  });   
});

//Returns array of all users in database//////////////////////////////////
app.get("/api/exercise/users", function(req, res, next) {
  //use Model.find() to obtain an array of existing users
  userModel.find({}, function(err, result) {
    if(err) {return next()};
    if(result == null) {
      return res.send("No user found in database");
    } else {
       let newArr = [];
    //Retreive the results that only appears during initial registration
    result.forEach(function(currentValue) {
      newArr.push({
        username : currentValue.user,
        _id: currentValue["_id"],
         __v: currentValue["__v"] 
      });
    });    
    return res.send(JSON.stringify(newArr));
    }   
  });  
});

//Adding exercises/////////////////////////////////////////////////////////////////
app.post('/api/exercise/add', function(req, res, next) {
  let input = {
    userId: req.body.userId,
    description: req.body.description,
    duration: req.body.duration,
    date: req.body.date
  };
  let id = req.body.userId;
  userModel.findById(id, function(err, result1) {
    if (err) {return next()};
    if (result1 == null) {
     return next();
    } else {
      //Method that filters date input in of the right format
      let dateCompute = function() {        
        if(input.date == "") {
          return (new Date()).toDateString();
        } else if (new Date(input.date) == null || new Date(input.date) == "Invalid Date"){
          return res.send(input.date + " is invalid date input");
        } else {
          return (new Date(input.date)).toDateString();
        };
      };      
      //Method that filters number input in the right format
      let durationCompute = function() {
        if (input.duration < 1) {
          return res.send("Duration is too short");
        } else {
          return input.duration;
        }
      };      
      let savedExData = new exerciseModel({
        userId: input.userId,
        description: input.description,
        duration: durationCompute(),
        date: dateCompute()
      }); 
      savedExData.save(function(err, result2) {
        if (err) {return next()};
        if (result2 !== null) {
          return res.json({
            userName: result1.user,
            description: result2.description,
            duration: result2.duration,
            _id: result1["_id"],
            date: result2.date
          }); 
        }
      });
    }
  });  
});

//Retreive user data within specified date and specified number limit
app.get('/api/exercise/log', function(req, res, next) {
  let idInput = req.query.userId;
  //set up optional queries object
  let queries = {
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit
  };
  
  //
  exerciseModel.find({userId:idInput}, function(err, result){
    if (err) {return next()};
    if (result.length == 0) {
      return res.send("User Id is not found");
    } else {
      let fetchName = function(){
        userModel.findById(idInput, function(err, result2) {
          if (err) {return next();};
          if (result2 == null) {
            
          } else {
            return result2.user;
          };
        });
      };
      //sort result in timely manner      
      result.sort((a, b) => { return Date.parse(a.date) - Date.parse(b.date);});      
      //Functions for optional parameters
      let optionalFrom = function() {
        if(queries.from === undefined ) {
           return undefined;
           } else if(JSON.stringify(new Date(queries.from)) === "null") {
             return res.send("Please enter date in correct format");
           } else {
             return result.findIndex((currentValue) => Date.parse(new Date(currentValue.date)) >= Date.parse(queries.from));
           }
      };
      let optionalTo =  function() {
        if(queries.to === undefined ) {
           return undefined;
           } else if(JSON.stringify(new Date(queries.to)) === "null") {
             return res.send("Please enter date in correct format");
           } else {
             return result.findIndex((currentValue) => Date.parse(new Date(currentValue.date)) >= Date.parse(queries.to));
           }
      };
      let optionalLimit = function() {
        if (queries.limit == "0" || queries.limit === undefined || queries.limit == "") {
          return undefined;
        } else if (Number.isInteger(Number(queries.limit)) === true && Number(queries.limit) > 0) {
           return Number(queries.limit);
        } else {
          return res.send("Please enter a positive integer number for limit")
        }
      };
      
       let optionalLog = function() {
         if (queries.limit === undefined && queries.from === undefined && queries.to ===undefined) {
             return result.reverse();
             } else {
           return result.slice(optionalFrom(), optionalTo()).slice(0, optionalLimit()).reverse();
         }
         
       };
          //return res.send(optionalLog());
     
      
      //returns final array and user information
        return res.json({
        _id: idInput,
        username: fetchName(),
        count: optionalLog().length,
        log: optionalLog()
      });  
          
     
    }
  }); 
}); 

// Not found middleware////////////////////////////////////////
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})
// Error Handling middleware/////////////////////////////////
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
