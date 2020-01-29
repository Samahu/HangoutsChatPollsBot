var PollComposer = function() {
  
  this.compose_vote_button = function(poll, index) {
    
    var choice = poll.choices[index];
    
    return {
        textButton: {
          text: choice,
          onClick: {
            action: {
              actionMethodName: "update-vote",
              parameters: [
                { key: "poll", value: JSON.stringify(poll) },
                { key: "index", value: index.toString() }
              ]
            }
          }
        }
      }
  }
  
  this.compose_vote_section = function(poll, index, total_votes) {
    
    var response = poll.responses[index];
    
    var widgets = [{ buttons: [this.compose_vote_button(poll, index)]}];
    
    var vote_percent = total_votes > 0 ? 100 * response.voters.length / total_votes : 0;
    
    widgets.push({ textParagraph: { text: Utilities.formatString("%.2f\% / (%d)", vote_percent, response.voters.length) }});
    
    if (!poll.options.anonymous)
    {
      var voters_list = response.voters.join(", ");
      widgets.push({ textParagraph: { text: Utilities.formatString("<i><font color='#808080'>%s</font></i>", voters_list) }});
    }
    
    return { widgets: widgets };
  }

  this.compose_footer_section = function(total_votes) {
    return { widgets: [{ textParagraph: { text: Utilities.formatString("<b>Total votes: %d<b>", total_votes) }}] }
  }

  this.compose_message_body = function(poll, total_votes, action_response_type) {

    sections = [];
    
    var poll_options = Utilities.formatString("[Poll Type: %s, Anonymous: %s]",
                                              poll.options.single_choice ? "Single Choice" : "Multi Choice",
                                              poll.options.anonymous ? "Yes" : "No");
    
    sections.push({ widgets: [{ textParagraph: { text: poll_options }}] });
    
    for (var i = 0; i < poll.responses.length; ++i) {
      sections.push(this.compose_vote_section(poll, i, total_votes));
    }
    
    sections.push(this.compose_footer_section(total_votes));
    
    var poll_created_by = Utilities.formatString("Poll created by %s.", poll.poller);
    
    return {
      actionResponse: { type: action_response_type },
      cards: [{
        header: { title: poll.question, subtitle : poll_created_by, imageUrl : DEFAULT_IMAGE_URL },
        sections: sections
      }]
    };
  }

  this.compose = function(poll_details) {

    var poll = poll_details;
    
    // Add a placeholder to record votes
    poll.responses = [];
    for each (var choice in poll.choices) {
      poll.responses.push({ voters: [] });
    }
    
    poll.initiated_on = new Date();
    
    return this.compose_message_body(poll, 0, "NEW_MESSAGE");
  }
  
  this.update_poll_multi_choice = function(voter, poll, index) {
    
    var response = poll.responses[index];
    var voter_index = response.voters.indexOf(voter);
    if (voter_index > -1)
      response.voters.splice(voter_index, 1);  // Already voted so remove
    else
      response.voters.push(voter);  // Didn't use this response yet
    
  }

  this.update_poll_single_choice = function(voter, poll, index) {

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
  
  this.is_poll_still_active = function(poll) {
    
    if (poll.options.expiration_time_in_seconds == 0.0)
      return true;
    
    var current_time = new Date();
    var initiated_on = new Date(poll.initiated_on);
    var date_diff_in_seconds = 0.001 * (current_time - initiated_on);
    
    return date_diff_in_seconds <= poll.options.expiration_time_in_seconds;
    
  }

  this.update = function(voter, poll, index) {
    
    if (!this.is_poll_still_active(poll))
      return { 'text': "this poll has expired!" };

    var poll_update_method = poll.options.single_choice ? this.update_poll_single_choice : this.update_poll_multi_choice;
    
    poll_update_method(voter, poll, index);
    
    var total_votes = poll.responses.reduce(function(total, response) { return total + response.voters.length; }, 0);
    
    return this.compose_message_body(poll, total_votes, "UPDATE_MESSAGE");
  }
}