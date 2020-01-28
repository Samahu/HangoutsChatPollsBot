// log proxy
var log = (function () {
  return {
    info: function (msg) { console.info(msg); },
    error: function (msg) { console.error(msg); }
  }
})();

var POLL_FORMATION_STATUS = { READY: 0, PARSE_POLL_TYPE: 1, PARSE_POLL_ANONYMOUS_PREF: 2, POST_POLL: 3 };

var Dialog = function (poll_data) {
  
  var current_state_from_poll_formation_status = function(poll_formation_status) {

    switch (poll_formation_status) {
      case POLL_FORMATION_STATUS.PARSE_POLL_TYPE:
        return new State_ParsePollType(this);
        
      case POLL_FORMATION_STATUS.PARSE_POLL_ANONYMOUS_PREF:
        return new State_ParseAnonymousPref(this);
      
      case POLL_FORMATION_STATUS.READY:
      default:
        return new State_Ready(this);
    }
    
  };

  this.poll_data = poll_data;
  var current_state = current_state_from_poll_formation_status(poll_data.poll_formation_status);
  
  this.change = function (state) {
    current_state = state;
    return current_state.start();
  };
 
  // process response
  this.process = function(owner, response) {
    
    log.info("process invoked!");
    
    switch (response.toLowerCase()) {
        // Top level commands
      case "help":
      case "usage":
        return { message : this.usage_message(), poll_data: this.poll_data };  // poll_data stays same.
        
      case "cancel": // TODO: Is it better to have this at top level?
        return { message : this.poll_is_canceled_message(), poll_data: null };  // clear poll_data
      
      default:
        return { message: current_state.process(owner, response), poll_data: this.poll_data };
    }
  };
  
  /* Some Helper Methods */
  this.usage_message = function() {
    return { 'text': "You may start a new poll by posting a question with choices as follows:" +
      "\n_When do you want to meet? Friday 8:00 PM, Saturday 8:00 AM, Sunday 3:00 PM_." +
      "\nThe bot would then ask you few questions about the nature of the poll." +
      "\n*Note 1:* A poll needs to have at least two options!" +
      "\n*Note 2:* During poll formation if any of you replies contain the '?' symbol then this would start a new poll!" };
  }
  
  this.response_is_ill_formed_or_unexpected_message = function() {
    return { "text": "Response is ill-formed or unexpected! Type 'help' or 'usage' to show how you may interact with this bot." };
  }
  
  this.poll_is_canceled_message = function() {
    return { "text": "Poll is canceled!" };
  }
}

// STATE Ready ---------------------
var State_Ready = function (dialog) {
  this.dialog = dialog;
  
  this.start = function (response) {
    log.info("State_Ready is selected");
    dialog.poll_data.poll_formation_status = POLL_FORMATION_STATUS.READY;
    return {};
  }
  
  this.process = function (owner, response) {
    
    var question_mark_index = response.indexOf('?');
    
    if (question_mark_index < 0)
      return dialog.response_is_ill_formed_or_unexpected_message();
    
    var question = response.substring(0, question_mark_index);
    var reminder = response.substring(question_mark_index + 1);
    var choices = reminder.split(",");
    
    if (choices.length < 2)
      return dialog.response_is_ill_formed_or_unexpected_message();
    
    dialog.poll_data = {
      poll_formation_status: dialog.poll_data.poll_formation_status,  // Unchanged!
      poller: owner,
      options: {
        single_choice: true,
        anonymous: true
      },
      question: question,
      choices: choices
    };
    
    log.info("State_Ready -> State_ParsePollType");  // TODO: Refactor this part! .. Should be moved into the change() method.
    return dialog.change(new State_ParsePollType(dialog));
  }
};

// STATE ParsePollType ---------------------
var State_ParsePollType = function (dialog) {
  this.dialog = dialog;
  
  this.request_poll_type_message = function(prefix) {
    
    var message = "What kind of poll do you want to have? single or multi choice?";
    
    if (prefix)
      message = prefix + message;
    
    return { "text": message };
  }
  
  this.start = function () {
    log.info("State_ParsePollType is selected");
    dialog.poll_data.poll_formation_status = POLL_FORMATION_STATUS.PARSE_POLL_TYPE;
    return request_poll_type_message();
  }
  
  this.process = function (owner, response) {
    
    var single_index = response.indexOf("single");
    var default_index = response.indexOf("default");
    
    if (single_index > -1 || default_index > -1) {
      dialog.poll_data.options.single_choice = true;
      return dialog.change(new State_ParseAnonymousPref(dialog));
    }
    
    var multi_index = message.indexOf("multi");
    
    if (multi_index > -1) {
      dialog.poll_data.options.single_choice = false;
      return dialog.change(new State_ParseAnonymousPref(dialog)); // TODO log.info("State_ParsePollType -> State_ParseAnonymousPref");
    }
    
    return dialog.response_is_ill_formed_or_unexpected_message(); // We didn't get any of the expected responses.
  }
  
};

// STATE ParseAnonymousPref ---------------------
var State_ParseAnonymousPref = function (dialog) {
  this.dialog = dialog;
  
  function request_anonymous_pref_message(prefix) {
    
    var message = "Should the poll be anonymous?";
    
    if (prefix)
      message = prefix + message;
    
    return { "text": message };
  }
  
  this.start = function () {
    log.info("State_ParseAnonymousPref is selected");
    dialog.poll_data.poll_formation_status = POLL_FORMATION_STATUS.PARSE_ANONYMOUS_PREF;
    return this.request_anonymous_pref_message();
  }
  
  this.process = function (owner, response) {
    
    var yes_index = response.indexOf("yes");
    var default_index = response.indexOf("default");
    var anonymous_index = response.indexOf("anonymous");
    
    
    if (yes_index > -1 || default_index > -1 || anonymous_index > -1) {
      dialog.poll_data.options.anonymous = true;
      return dialog.change(new State_PostPoll(dialog));
    }
    
    var no_index = response.indexOf("no");
    var identified_index = response.indexOf("identified");
    var known_index = response.indexOf("known");
    
    if (no_index > -1 || identified_index > -1 || known_index > -1) {
      dialog.poll_data.options.anonymous = false;
      return dialog.change(new State_PostPoll(dialog));
    }
    
    return dialog.request_anonymous_pref_message("Sorry, I need to know your exact response .. ");
  }
};

// STATE PostPoll ---------------------
var State_PostPoll = function (dialog) {
  this.dialog = dialog;
  
  this.start = function() {
    log.info("State_PostPoll is selected");
    dialog.poll_data.poll_formation_status = POLL_FORMATION_STATUS.POST_POLL;
    return PollBuilder().postPoll();
  }
  
  this.process = function (owner, response) {
    // TODO: this wouldn't be invoked typically .. I presume.
    dialog.poll_data = null;
  }
}
