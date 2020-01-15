# Hangouts Chat Polls Bot
Builds a custom poll within hangouts chat

# Configuration
Please refer to https://developers.google.com/hangouts/chat/how-tos/bots-publish on how to add the bot to configure and prepare be your bot for deployment.  
Additioanlly in the code make sure to set the BOT_NAME variable to match the name you picked for your bot during bot configuration step.

# Usage
After you add the bot to a room or a space you may start a new poll by posting a question with choices as follows:  
_When do you want to meet? Friday 8:00 PM, Saturday 8:00 AM, Sunday 3:00 PM._  
The bot would then ask you few questions about the nature of the poll.  
*Note 1:* A poll needs to have at least two options!  
*Note 2:* During poll formation if any of you replies contain the '?' symbol then this would start a new poll!  

# Roadmap
Features to come:
 - Add an expiration timer option for when constructing the poll.
 - For time based polls add the ability to show time correctly by the participant time zone.
 - Add the ability for sub responses .. (for example: show YES, NO, Maybe under a given possible response).
