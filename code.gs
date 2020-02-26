const DEFAULT_IMAGE_URL = 'https://goo.gl/bMqzYS';
const BOT_NAME = "@Hangouts Chat Polls Bot";

/**
 * Responds to a MESSAGE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onMessage(event) {
  
  log.info(JSON.stringify(event));
  
  let message = event.message.text;
  if (0 == message.indexOf(BOT_NAME))
    message = message.substring(BOT_NAME.length);
  message = message.trim();
  
  let poller = event.user.displayName;
  
  let poll_details = new PollDetails();
  poll_details.load();
  let response_message = (new Dialog(poll_details)).process(poller, message);
  poll_details.save();
  
  return response_message;
}

/**
 * Responds to a CARD_CLICKED event triggered in Hangouts Chat.
 * @param {object} event the event object from Hangouts Chat
 * @return {object} JSON-formatted response
 * @see https://developers.google.com/hangouts/chat/reference/message-formats/events
 */
function onCardClick(event) {
  
  log.info(JSON.stringify(event));
  
  let message = '';
  
  if (event.action.actionMethodName == "update-vote") {
    let poll = JSON.parse(event.action.parameters[0].value);
    let index = parseInt(event.action.parameters[1].value);
    message = (new PollComposer()).update(event.user.displayName, poll, index);
  } else {
    message = {text: "Unexpected!!" };
  }
  
  log.info(message);
  
  return message;
}

/**
 * Responds to an ADDED_TO_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onAddToSpace(event) {

  let message = "";

  if (event.space.type == "DM") {
    message = "Thank you for adding me to a DM, " + event.user.displayName + "!";
  } else {
    message = "Thank you for adding me to " + event.space.displayName;
  }
  
  message += "\nType 'help' to list usage information for you";

  return { "text": message };
}

/**
 * Responds to a REMOVED_FROM_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onRemoveFromSpace(event) {
  log.info("Bot removed from ", event.space.name);
  return { 'text': 'Goodbye!' }
}