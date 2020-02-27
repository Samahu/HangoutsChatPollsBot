const POLL_FORMATION_STATUS = { READY: 0, PARSE_POLL_TYPE: 1, PARSE_POLL_ANONYMITY_PREF: 2, PARSE_POLL_EXPIRATION_TIME: 3, POST_POLL: 100 };

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
        
      case POLL_FORMATION_STATUS.PARSE_POLL_ANONYMITY_PREF:
        return new State_ParseAnonymousPref(this);
        
      case POLL_FORMATION_STATUS.PARSE_POLL_EXPIRATION_TIME:
        return new State_ParseExpirationTime(this);
      
      case POLL_FORMATION_STATUS.READY:
      default:
        return new State_Ready(this);
    }
  };
  
  var current_state = this.current_state_from_poll_formation_status(poll_details.get().poll_formation_status);
  
  this.change = function (state) {
    
    let log_message = "Changing state";
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
    
    log.info("response is " + response);

    switch (response.toLowerCase()) {
        // Top level commands
      case "help":
        return this.help_message();
        
      case "usage":
        return this.usage_message();
        
      case "version":
        return this.version_message();
        
      case "cancel":
        let message = "";
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
  this.help_message = function() {
    return { text: `You may start a new poll by posting a question with choices as follows:
      _When do you want to meet? Friday 8:00 PM, Saturday 8:00 AM, Sunday 3:00 PM_.
      The bot would then ask you few questions about the nature of the poll.
      *Note:* A poll needs to have at least two options!` };
  }
  
  this.usage_message = function() {
    return { text: "*Poll Question? Option 1[ -> Option 1 Description], Option 2[ -> Option 2 Description] [, Option 3[ -> Option 3 Description], ...]*" };
  }
  
  this.version_message = function() {
    return { text: "version 1.1.0" };
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
    
    let question_mark_index = response.indexOf('?');
    
    if (question_mark_index < 0)
      return dialog.response_is_ill_formed_or_unexpected_message();
    
    let question = response.substring(0, question_mark_index);
    let reminder = response.substring(question_mark_index + 1);
    let choices = reminder.split(",");
    
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
    
    let message = `${prefix ? prefix : ""}What kind of poll do you want to have? single or multi choice?`;    
    return { text: message };
  }
  
  this.start = function () {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.PARSE_POLL_TYPE;
    return this.request_poll_type_message();
  }
  
  this.process = function (owner, response) {
    
    response = response.toLowerCase();
    
    let single_index = response.indexOf("single");
    let default_index = response.indexOf("default");
    
    if (single_index > -1 || default_index > -1) {
      dialog.get_poll_details().options.single_choice = true;
      return dialog.change(new State_ParseAnonymousPref(dialog));
    }
    
    let multi_index = response.indexOf("multi");
    
    if (multi_index > -1) {
      dialog.get_poll_details().options.single_choice = false;
      return dialog.change(new State_ParseAnonymousPref(dialog));
    }
    
    return this.request_poll_type_message("Sorry, I need to know your exact response .. "); // We didn't get any of the expected responses.
  }
  
};

// State_ParseAnonymousPref ---------------------
var State_ParseAnonymousPref = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_ParseAnonymousPref";
  
  this.request_anonymous_pref_message = function(prefix) {
    let message = `${prefix ? prefix : ""}Should the poll be anonymous?`;    
    return { text: message };
  }
  
  this.start = function () {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.PARSE_POLL_ANONYMITY_PREF;
    return this.request_anonymous_pref_message();
  }
  
  this.process = function(owner, response) {
    
    response = response.toLowerCase();
    
    let yes_index = response.indexOf("yes");
    let default_index = response.indexOf("default");
    let anonymous_index = response.indexOf("anonymous");
    
    if (yes_index > -1 || default_index > -1 || anonymous_index > -1) {
      dialog.get_poll_details().options.anonymous = true;
      return dialog.change(new State_ParseExpirationTime(dialog));
    }
    
    let no_index = response.indexOf("no");
    let identified_index = response.indexOf("identified");
    let known_index = response.indexOf("known");
    
    if (no_index > -1 || identified_index > -1 || known_index > -1) {
      dialog.get_poll_details().options.anonymous = false;
      return dialog.change(new State_ParseExpirationTime(dialog));
    }
    
    return this.request_anonymous_pref_message("Sorry, I need to know your exact response .. ");
  }
};

// State_ParseExpirationTime ---------------------
var State_ParseExpirationTime = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_ParseExpirationTime";
  
  this.request_how_long_to_keep_active_message = function(prefix) {
    
    let message = `${prefix ? prefix : ""}How long to keep this poll active? You may respond using a number followed by a time unit (for example: 10 seconds, 5 h, 2days, 1 week, ..). When no time unit is specified hours are assumed. You may respond with 'never' or 0 to indicate that this poll doesn't expire`;
    return { text: message };
  }
  
  this.start = function () {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.PARSE_POLL_EXPIRATION_TIME;
    return this.request_how_long_to_keep_active_message();
  }
  
  this.normialize_time_unit_to_hours = function(period, unit) {
    switch (unit) {
      case 'm': return period * 60;
      case 'h': return period * 60 * 60;
      case 'd': return period * 60 * 60 * 24;
      case 'w': return period * 60 * 60 * 24 * 7;
      default:  return period; // includes case 's' seconds
    }
  }
  
  this.process = function(owner, response) {
    
    response = response.toLowerCase();
    
    let never_index = response.indexOf("never");
    
    if (never_index > -1) {
      dialog.get_poll_details().options.expiration_time_in_seconds = 0.0;
      return dialog.change(new State_PostPoll(dialog));
    }
    
    let period_unit_regex = /(\d+)\s?([smhdw]?)/;
    let groups = response.match(period_unit_regex);
    
    if (groups && groups.length >= 1) {
      let period = parseInt(groups[1]);
      let unit = groups[2] ? groups[2] : 'h';
      dialog.get_poll_details().options.expiration_time_in_seconds = this.normialize_time_unit_to_hours(period, unit);
      return dialog.change(new State_PostPoll(dialog));
    }
    
    return this.request_how_long_to_keep_active_message("Sorry, I need to know your exact response .. ");
  }
};

// State_PostPoll ---------------------
var State_PostPoll = function (dialog) {
  
  var dialog = dialog;
  this.name = "State_PostPoll";
  
  this.start = function() {
    dialog.get_poll_details().poll_formation_status = POLL_FORMATION_STATUS.POST_POLL;
    let message = (new PollComposer()).compose(dialog.get_poll_details());
    dialog.clear_poll_details();
    return message;
  }
  
  this.process = function (owner, response) {
    log.error("This wouldn't be invoked .. typically");
  }
}