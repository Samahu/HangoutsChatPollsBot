var POLL_FORMATION_STATUS = { READY: 0, PARSE_POLL_TYPE: 1, PARSE_POLL_ANONYMOUS_PREF: 2, POST_POLL: 3 };

var Dialog = function (poll_details) {
  
  var poll_details = poll_details;
  
  this.get_poll_details = function() {
    return poll_details.get();
  }
  
  this.clear_poll_details = function() {
    poll_details.clear();
  }
  
  this.current_state_from_poll_formation_status = function(poll_formation_status) {

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
  
  var current_state = this.current_state_from_poll_formation_status(poll_details.get().poll_formation_status);
  
  this.change = function (state) {
    
    var log_message = "Changing state";
    if (current_state)
      log_message += " from [" + current_state.name + "]";
    
    current_state = state;
    
    if (current_state)
      log_message += " to [" + current_state.name + "]";
    
    log.info(log_message)
    
    return current_state.start();
    
  };
 
  // process response from the user according to current state.
  this.process = function(owner, response) {

    switch (response.toLowerCase()) {
        // Top level commands
      case "help":
      case "usage":
        return this.usage_message();  // poll details is unchanged.
        
      case "cancel":
        var message = "";
        if (poll_details.get().poll_formation_status == POLL_FORMATION_STATUS.READY)
          message = this.nothing_to_cancel_message();
        else
          message = this.poll_is_canceled_message();
        
        this.clear_poll_details();
        return message;
      
      default:
        return current_state.process(owner, response);
    }
  };
  
  /* predefined messages */
  this.usage_message = function() {
    return { text: "You may start a new poll by posting a question with choices as follows:" +
      "\n_When do you want to meet? Friday 8:00 PM, Saturday 8:00 AM, Sunday 3:00 PM_." +
      "\nThe bot would then ask you few questions about the nature of the poll." +
      "\n*Note 1:* A poll needs to have at least two options!" +
      "\n*Note 2:* During poll formation if any of you replies contain the '?' symbol then this would start a new poll!" };
  }
  
  this.response_is_ill_formed_or_unexpected_message = function() {
    return { text: "Response is ill-formed or unexpected! Type 'help' or 'usage' to show how you may interact with this bot." };
  }
  
  this.nothing_to_cancel_message = function() {
    return { text: "Nothing to cancel!" };
  }
  
  this.poll_is_canceled_message = function() {
    return { text: "Poll is canceled!" };
  }
}

// State_Ready ---------------------
var State_Ready = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_Ready";
  
  this.start = function (response) {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.READY;
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
    
    dialog.get_poll_details().poller = owner;
    dialog.get_poll_details().question = question;
    dialog.get_poll_details().choices = choices;
    
    return dialog.change(new State_ParsePollType(dialog));
  }
};

// State_ParsePollType ---------------------
var State_ParsePollType = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_ParsePollType";
  
  this.request_poll_type_message = function(prefix) {
    
    var message = "What kind of poll do you want to have? single or multi choice?";
    
    if (prefix)
      message = prefix + message;
    
    return { text: message };
  }
  
  this.start = function () {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.PARSE_POLL_TYPE;
    return this.request_poll_type_message();
  }
  
  this.process = function (owner, response) {
    
    response = response.toLowerCase();
    
    var single_index = response.indexOf("single");
    var default_index = response.indexOf("default");
    
    if (single_index > -1 || default_index > -1) {
      dialog.get_poll_details().options.single_choice = true;
      return dialog.change(new State_ParseAnonymousPref(dialog));
    }
    
    var multi_index = response.indexOf("multi");
    
    if (multi_index > -1) {
      dialog.get_poll_details().options.single_choice = false;
      return dialog.change(new State_ParseAnonymousPref(dialog)); // TODO log.info("State_ParsePollType -> State_ParseAnonymousPref");
    }
    
    return this.request_poll_type_message("Sorry, I need to know your exact response .. "); // We didn't get any of the expected responses.
  }
  
};

// State_ParseAnonymousPref ---------------------
var State_ParseAnonymousPref = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_ParseAnonymousPref";
  
  this.request_anonymous_pref_message = function(prefix) {
    
    var message = "Should the poll be anonymous?";
    
    if (prefix)
      message = prefix + message;
    
    return { text: message };
  }
  
  this.start = function () {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.PARSE_POLL_ANONYMOUS_PREF;
    return this.request_anonymous_pref_message();
  }
  
  this.process = function(owner, response) {
    
    response = response.toLowerCase();
    
    var yes_index = response.indexOf("yes");
    var default_index = response.indexOf("default");
    var anonymous_index = response.indexOf("anonymous");
    
    if (yes_index > -1 || default_index > -1 || anonymous_index > -1) {
      dialog.get_poll_details().options.anonymous = true;
      return dialog.change(new State_PostPoll(dialog));
    }
    
    var no_index = response.indexOf("no");
    var identified_index = response.indexOf("identified");
    var known_index = response.indexOf("known");
    
    if (no_index > -1 || identified_index > -1 || known_index > -1) {
      dialog.get_poll_details().options.anonymous = false;
      return dialog.change(new State_PostPoll(dialog));
    }
    
    return this.request_anonymous_pref_message("Sorry, I need to know your exact response .. ");
  }
};

// State_PostPoll ---------------------
var State_PostPoll = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_PostPoll";
  
  this.start = function() {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.POST_POLL;
    var message = (new PollComposer()).compose(dialog.get_poll_details());
    dialog.clear_poll_details();
    return message;
  }
  
  this.process = function (owner, response) {
    log.error("This wouldn't be invoked .. typically");
  }
}