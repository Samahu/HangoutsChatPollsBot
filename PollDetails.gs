function PollDetails() {
  
  this.init = function() {
    this.poll_data = {
      poll_formation_status: POLL_FORMATION_STATUS.READY,
      poller: "",
      options: {
        single_choice: true,
        anonymous: true,
        expiration_time_in_seconds: 0.0
      },
      question: "",
      choices: []
    };
  }
  
  this.clear = function() {
    this.poll_data = null;
  }
  
  this.get = function() {
    return this.poll_data;
  }
  
  this.load = function() {
    // Deserialize any pending poll details from user properties
    let user_properties = PropertiesService.getUserProperties();
    let poll_data = user_properties.getProperty('POLL_DATA');
    
    // log.info(`LOAD: ${poll_data}`);
    
    if (poll_data == null)
      this.init();
    else
      this.poll_data = JSON.parse(poll_data);
  }
  
  this.save = function() {
    let user_properties = PropertiesService.getUserProperties();
    
    // Serialize poll details (if any) back into user properties
    if (this.poll_data == null)
      user_properties.deleteProperty("POLL_DATA");
    else {
      let serialized_poll_data = JSON.stringify(this.poll_data);
      // log.info(`SAVE: ${serialized_poll_data}`);
      user_properties.setProperty("POLL_DATA", serialized_poll_data);
    }
  }
}