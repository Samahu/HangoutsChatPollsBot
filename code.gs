var DEFAULT_IMAGE_URL = 'https://goo.gl/bMqzYS';
var BOT_NAME = "@HangoutsChatPollsBot";
var POLL_FORMATION_STATUS = { READY: 0, RETRIEVE_POLL_TYPE: 1, RETRIEVE_POLL_ANONYMOUS_PREF: 2, POST_POLL: 3 };

function composeVoteSection(poll, index, total_votes) {
  
  var response = poll.responses[index];
  
  var widgets = [{
      "buttons": [{
      "textButton": {
        "text": response.value,
        "onClick": {
          "action": {
            "actionMethodName": "update-vote",
            "parameters": [
              { "key": "poll", "value": JSON.stringify(poll) },
              { "key": "index", "value": index.toString() }
            ]
          }
        }
      }
    }
 ]}
 ];
  
  var vote_percent = total_votes > 0 ? 100 * response.voters.length / total_votes : 0;
  
  widgets.push({"textParagraph": { "text": Utilities.formatString("%.2f\% / (%d)", vote_percent, response.voters.length) }});
  
  if (!poll.options.anonymous)
  {
    var voters_list = response.voters.join(", ");
    widgets.push({"textParagraph": { "text": Utilities.formatString("<i><font color='#808080'>%s</font></i>", voters_list) }});
  }
  
  return { "widgets": widgets };
}

function composeFooterSection(total_votes) {
  return { "widgets": [{"textParagraph": { "text": Utilities.formatString("<b>Total votes: %d<b>", total_votes) }}] }
}

function composeMessageBody(poll, total_votes, action_response_type) {
  
  sections = [];
  
  var poll_options = Utilities.formatString("[Poll Type: %s, Anonymous: %s]",
                                    poll.options.single_choice ? "Single Choice" : "Multi Choice",
                                    poll.options.anonymous ? "Yes" : "No");
  
  sections.push({ "widgets": [{"textParagraph": { "text": poll_options }}] });
  
  for (var i = 0; i < poll.responses.length; ++i) {
    sections.push(composeVoteSection(poll, i, total_votes));
  }
  
  sections.push(composeFooterSection(total_votes));
  
  var poll_created_by = Utilities.formatString("Poll created by %s.", poll.poller);
  
  return {
    "actionResponse": { "type": action_response_type },
    "cards": [{
      "header": { "title": poll.question, "subtitle" : poll_created_by, "imageUrl" : DEFAULT_IMAGE_URL },
      "sections": sections
    }]
  };
}

function postPoll(poll_placeholder) {

  var responses = [];

  for each (var raw_response in poll_placeholder.raw_responses) {
    responses.push({ "value": raw_response, "voters": [] });
  }
  
  var poll = { "poller": poll_placeholder.poller, "options": poll_placeholder.options, "question" : poll_placeholder.question, "responses": responses };
  
  return composeMessageBody(poll, 0, "NEW_MESSAGE");
}

function usageMessage() {
  return { text: "You may start a new poll by posting a question with choices as follows:" +
    "\n_When do you want to meet? Friday 8:00 PM, Saturday 8:00 AM, Sunday 3:00 PM_." +
      "\nThe bot would then ask you few questions about the nature of the poll." +
      "\n*Note 1:* A poll needs to have at least two options!" +
      "\n*Note 2:* During poll formation if any of you replies contain the '?' symbol then this would start a new poll!" };
}

function pollIsIllFormedMessage() {
  return { "text": "Poll is ill-formed! Type 'help' or 'usage' to show how you may interact with this bot." };
}

function requestPollTypeMessage(prefix) {
  var messageBody = "What kind of poll do you want to have? single or multi choice?";
  
  if (prefix)
    messageBody = prefix + messageBody;
  
  return { "text": messageBody };
}

function parsePoll(poller, message, poll_placeholder, userProperties) {
  
  console.info("parsePoll + " + message);
  
  var question_mark_index = message.indexOf('?');
  
  if (question_mark_index < 0)
    return pollIsIllFormedMessage();

  var question = message.substring(0, question_mark_index);
  var reminder = message.substring(question_mark_index + 1);
  
  var raw_responses = reminder.split(",");
  
  if (raw_responses.length < 2)
    return pollIsIllFormedMessage();
  
  poll_placeholder = { "poller": poller, "options": { "single_choice": true, "anonymous": true }, "question" : question, "raw_responses": raw_responses };
  
  userProperties.setProperty("POLL_FORMATION_STATUS", POLL_FORMATION_STATUS.RETRIEVE_POLL_TYPE);
  userProperties.setProperty("POLL_PLACEHOLDER", JSON.stringify(poll_placeholder));
  
  return requestPollTypeMessage();
}

function requestAnonymousPrefMessage(prefix) {
  var messageBody = "Should the poll be anonymous?";
  
  if (prefix)
    messageBody = prefix + messageBody;
  
  return { "text": messageBody };
}

function pollCancelledMessage() {
  return { "text": "Poll is canceled!" };
}

function parseRetrievePollType(poller, message, poll_placeholder, userProperties) {
  
  console.info("parseRetrievePollType + " + message);
  
  var cancel_index = message.indexOf("cancel");
  
  if (cancel_index > -1) {
    userProperties.deleteProperty("POLL_FORMATION_STATUS");
    userProperties.deleteProperty("POLL_PLACEHOLDER");
    return pollCancelledMessage();
  }
  
  var single_index = message.indexOf("single");
  var default_index = message.indexOf("default");

  if (single_index > -1 || default_index > -1) {
    poll_placeholder.options.single_choice = true;
    userProperties.setProperty("POLL_FORMATION_STATUS", POLL_FORMATION_STATUS.RETRIEVE_POLL_ANONYMOUS_PREF);
    userProperties.setProperty("POLL_PLACEHOLDER", JSON.stringify(poll_placeholder));
    return requestAnonymousPrefMessage();
  }
  
  var multi_index = message.indexOf("multi");

  if (multi_index > -1) {
    poll_placeholder.options.single_choice = false;
    userProperties.setProperty("POLL_FORMATION_STATUS", POLL_FORMATION_STATUS.RETRIEVE_POLL_ANONYMOUS_PREF);
    userProperties.setProperty("POLL_PLACEHOLDER", JSON.stringify(poll_placeholder));
    return requestAnonymousPrefMessage();
  }
  
  return requestPollTypeMessage("Sorry, I need to know your exact response .. ");
}

function parseRetrieveAnonymousPref(poller, message, poll_placeholder, userProperties) {
  
  console.info("parseRetrieveAnonymousPref + " + message);
  
  var cancel_index = message.indexOf("cancel");
  
  if (cancel_index > -1) {
    userProperties.deleteProperty("POLL_FORMATION_STATUS");
    userProperties.deleteProperty("POLL_PLACEHOLDER");
    return pollCancelledMessage();
  }
  
  var yes_index = message.indexOf("yes");
  var default_index = message.indexOf("default");
  var anonymous_index = message.indexOf("anonymous");
  

  if (yes_index > -1 || default_index > -1 || anonymous_index > -1) {
    poll_placeholder.options.anonymous = true;
    userProperties.deleteProperty("POLL_FORMATION_STATUS");
    userProperties.deleteProperty("POLL_PLACEHOLDER");
    return postPoll(poll_placeholder);
  }
  
  var no_index = message.indexOf("no");
  var identified_index = message.indexOf("identified");
  var known_index = message.indexOf("known");

  if (no_index > -1 || identified_index > -1 || known_index > -1) {
    poll_placeholder.options.anonymous = false;
    userProperties.deleteProperty("POLL_FORMATION_STATUS");
    userProperties.deleteProperty("POLL_PLACEHOLDER");
    return postPoll(poll_placeholder);
  }
  
  return requestAnonymousPrefMessage("Sorry, I need to know your exact response .. ");
}

function buildPoll(poller, message) {
  
  var userProperties = PropertiesService.getUserProperties();
  var poll_formation_status = userProperties.getProperty('POLL_FORMATION_STATUS');
  var poll_placeholder = userProperties.getProperty('POLL_PLACEHOLDER');
  poll_formation_status = poll_formation_status == null ? POLL_FORMATION_STATUS.READY : parseInt(poll_formation_status);  
  poll_placeholder = poll_placeholder == null ? {} : JSON.parse(poll_placeholder);

  switch (poll_formation_status) {
    case POLL_FORMATION_STATUS.READY:
      return parsePoll(poller, message, poll_placeholder, userProperties);
      
    case POLL_FORMATION_STATUS.RETRIEVE_POLL_TYPE:
      return parseRetrievePollType(poller, message.toLowerCase(), poll_placeholder, userProperties);
      
    case POLL_FORMATION_STATUS.RETRIEVE_POLL_ANONYMOUS_PREF:
      return parseRetrieveAnonymousPref(poller, message.toLowerCase(), poll_placeholder, userProperties);
      
    default:
      return { text: "Unexpected case!" };
  }
}

function onMessage(event) {
  console.info(JSON.stringify(event));
  
  var message = event.message.text;
  if (0 == message.indexOf(BOT_NAME))
    message = message.substring(BOT_NAME.length);
  
  var poller = event.user.displayName;
  
  switch (message.toLowerCase()) {
    case "help":
    case "usage":
      return usageMessage();
      
    default:
      return buildPoll(poller, message);
  }
}

function updatePollMultiChoice(voter, poll, index) {
  var response = poll.responses[index];
  var voter_index = response.voters.indexOf(voter);
  if (voter_index > -1)
    response.voters.splice(voter_index, 1);  // Already voted so remove
  else
    response.voters.push(voter);  // Didn't use this response yet
}

function updatePollSingleChoice(voter, poll, index) {

  // if the user clicked on the same choice then remove.
  var voter_response = poll.responses[index];
  var voter_index = voter_response.voters.indexOf(voter);
  if (voter_index > -1) {
    voter_response.voters.splice(voter_index, 1);
    return;
  }
  
  // search all other responses and see if the voter has already voted .. if so remove and then add the new selection
  for each (var response in poll.responses) {
    
    if (response == voter_response)
      continue;
    
    var voter_index = response.voters.indexOf(voter);
    if (voter_index > -1) {
      response.voters.splice(voter_index, 1);
      break;
    }
    
  }
  
  voter_response.voters.push(voter);  // Set the new selection
}

function updatePoll(voter, poll, index) {

  if (poll.options.single_choice)
    updatePollSingleChoice(voter, poll, index);
  else
    updatePollMultiChoice(voter, poll, index);
  
  var total_votes = poll.responses.reduce(function(total, response) { return total + response.voters.length; }, 0);
  
  return composeMessageBody(poll, total_votes, "UPDATE_MESSAGE");
}

/**
 * Responds to a CARD_CLICKED event triggered in Hangouts Chat.
 * @param {object} event the event object from Hangouts Chat
 * @return {object} JSON-formatted response
 * @see https://developers.google.com/hangouts/chat/reference/message-formats/events
 */
function onCardClick(event) {
  console.info(JSON.stringify(event));
  var message = '';
  
  if (event.action.actionMethodName == "update-vote") {
    var poll = JSON.parse(event.action.parameters[0].value);
    var index = parseInt(event.action.parameters[1].value);
    message = updatePoll(event.user.displayName, poll, index);
  } else {
    message = {text: "Unexpected!!" };
  }
  
  console.info(message);
  
  return message;
}

/**
 * Responds to an ADDED_TO_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onAddToSpace(event) {
  var message = "";

  if (event.space.type == "DM") {
    message = "Thank you for adding me to a DM, " + event.user.displayName + "!";
  } else {
    message = "Thank you for adding me to " + event.space.displayName;
  }

  return { "text": message };
}

/**
 * Responds to a REMOVED_FROM_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onRemoveFromSpace(event) {
  console.info("Bot removed from ", event.space.name);
}
