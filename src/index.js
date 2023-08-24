function Html5playerDebug() {
  console.warn('Warning! Do not use the html5player-debug package in production!');

  const playerEvents = [
    'abort',
    'canplay',
    'canplaythrough',
    'complete',
    'cuechange',
    'durationchange',
    'emptied',
    'encrypted',
    'ended',
    'error',
    'invalid',
    'loadeddata',
    'loadedmetadata',
    'loadstart',
    'pause',
    'play',
    'playing',
    'progress',
    'ratechange',
    'securitypolicyviolation',
    'seeked',
    'seeking',
    'stalled',
    'suspend',
    'timeupdate',
    'volumechange',
    'waiting',
    'waitingforkey'
  ];

  const errorCodes = [
    'N/A',
    'MEDIA_ERR_ABORTED: The fetching of the associated resource was aborted by the user\'s request.',
    'MEDIA_ERR_NETWORK: Some kind of network error occurred which prevented the media from being successfully fetched, despite having previously been available.',
    'MEDIA_ERR_DECODE: Despite having previously been determined to be usable, an error occurred while trying to decode the media resource, resulting in an error.',
    'MEDIA_ERR_SRC_NOT_SUPPORTED: The associated resource or media provider object (such as a MediaStream) has been found to be unsuitable.'
  ];

  let startTime = 0;
  const eventHistory = {};
  const pastEventHistory = [];
  let video;
  let hasUpdatedTime = false;
  let lastBuffer = 0;
  const increments = {};
  let lastEventType;
  let lastTimeUpdateText, lastTimeUpdateTime;
  let sampleTime = -1;
  let oldMBits = 0;
  let fibonacci = [0,1];
  let skippedTimeUpdates = 0;

  const resetVars = () => {
    lastBuffer = 0;
    oldMBits = 0;
    fibonacci = [0,1];
    sampleTime = -1;
    let eventHistoryCopy = {};
    for (let key in eventHistory) {
      eventHistoryCopy[key] = eventHistory[key];
      delete eventHistory[key];
    }
    pastEventHistory.push(eventHistoryCopy);
  };

  const getTrackInfo = () => {
    let text = '';
    const source = video?.srcObject;
    const tracks = source?.videoTracks || [];
    let track = '';
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].selected === 1) {
        track = JSON.stringify(tracks[i]);
        break;
      }
    }
    if (track) {
      text += `, ${track}`;
    }

    return text;
  };

  const getResolution = () => {
    let text = '';
    if (video.videoWidth) {
      text = ` Resolution=${video.videoWidth}x${video.videoHeight}px`;
    }

    return text;
  };

  // Only for webkit browers, and will probably be removed from those too
  const getBitrate = () => {
    let text = '';
    let dt = video.currentTime - sampleTime;
    if (video.webkitVideoDecodedByteCount > 0 && dt > 0) {
      const newMBits = 8 * (video.webkitAudioDecodedByteCount + video.webkitVideoDecodedByteCount) / (1024*1024); // Mbits
      const bitrate = Math.round(10*(newMBits - oldMBits)/dt)/10; // One decimal
      const fibSum = fibonacci[0] + fibonacci[1];
      fibonacci.shift();
      fibonacci.push(fibSum);
      sampleTime = video.currentTime;
      oldMBits = newMBits;
      text = `, Bitrate=${bitrate}Mbps`;
    }

    return text;
  };

  const log = (evtType, text, t, vtime) => {
    if (!eventHistory[t]) {
      eventHistory[t] = [];
    }
    console.log('>>> Player event', evtType, text, t);
    eventHistory[t].push(evtType + text + vtime);
  };

  const resetTime = () => {
    if (startTime > 0) {
      resetVars();
      log('Note', ` - timer reset at ${Date.now() - startTime}`, 0, '');
    } else {
      log('Note', ' - timer started', 0, '');
    }
    startTime = Date.now();
  };

  const getTimeRange = (timeRange) => {
    let start = 0; stop = 0;
    const stopIndex = (timeRange?.length || 0) - 1;
    if (stopIndex > -1) {
      start = Math.round(timeRange.start(0));
      stop = Math.round(timeRange.end(stopIndex));
    }

    return {start: start, stop: stop};
  };

  const debug = evt => {
    if (!startTime) {
      resetTime();
    }
    const t = Date.now() - startTime;
    let vtime = '';
    if (!hasUpdatedTime && !isNaN(evt.target?.currentTime) && evt.target?.currentTime > 0 && evt.type !== 'timeupdate') {
      hasUpdatedTime = true;
      vtime = `, t=${Math.round(100*evt.target.currentTime)/100}s`;
    }

    let text = '';
    let isBitrateUpdate = false;
    let evtType = evt.type;
    let seekable;

    switch (evt.type) {
      case 'progress':
        const range = getTimeRange(evt.target?.buffered);
        if (range.stop > 0) {
          let increment = range.stop - range.start - lastBuffer;
          if (increment > 0) {
            if (increments[increment]) {
              increments[increment]++;
            } else {
              increments[increment] = 1;
            }
            lastBuffer = range.stop - range.start;
          }
          text = `, buffer ${range.start}-${range.stop}s`;
        }
        break;
      case 'timeupdate':
        text = ` ${Math.round(100*evt.target.currentTime)/100}s`;
        lastTimeUpdateText = text;
        lastTimeUpdateTime = t;
        if (sampleTime < 0) {
          sampleTime = evt.target.currentTime;
        } else if ((evt.target.currentTime - sampleTime) > (fibonacci[0] + fibonacci[1])) {
          log('Note -', getResolution() + getBitrate(), t, vtime);
        }
        break;
      case 'durationchange':
        text = ` ${Math.round(100*evt.target.duration)/100}s`;
        break;
      case 'error':
        const error = evt.target.error;
        text = ` ${errorCodes[error.code]} ${error.message}`;
        break;
      case 'encrypted':
        text = ` (drm) ${evt.initDataType}`;
        break;
      case 'message':
        window.test1 = evt;
        console.log('test1', evt);
        text = ` (drm) ${evt.messageType}, byteLength=${evt?.message?.byteLength}`;
        //text += `, keyStatuses = ${evt.target?.keyStatuses}`;
        break;
      case 'waitingforkey':
      case 'keystatuseschange':
        window.test2 = evt;
        console.log('test2', evt);
        text = ' (drm)';
        //text += `, keyStatuses = ${evt.target?.keyStatuses}`;
        if (evt.target?.expiration > 0) {
          text += `, expires in ${Math.round((evt.target?.expiration - Date.now())/(10*60*60))/100}h`;
        }
        break;
      case 'ratechange':
      case 'loadedmetadata':
      case 'pause':
        const resolution = getResolution();
        if (resolution) {
          log('Note -', resolution + getBitrate(), t, vtime);
        }
        seekable = getTimeRange(evt.target?.seekable);
        if (seekable.stop > 0) {
          text = `, seekable=${seekable.start}-${seekable.stop}s`;
        }
        break;
      case 'checkpoint':
        text = ` ${evt.text}`;
        break;
      case 'playing':
        fibonacci = [0,1];
        sampleTime = evt.target.currentTime;
        break;
      case 'seeking':
        vtime = `, t=${Math.round(100*evt.target.currentTime)/100}s`;
    }
    // Maybe display these video props (on change):
    // networkState
    // readyState

    if (evt.type !== 'timeupdate' || lastEventType !== 'timeupdate') {
      if (lastEventType === 'timeupdate') {
        if (skippedTimeUpdates > 1) {
          skippedTimeUpdates--;
          log('Note -', ` skipped ${skippedTimeUpdates} timeupdates`, lastTimeUpdateTime - 1, vtime);
          log('timeupdate', lastTimeUpdateText, lastTimeUpdateTime, vtime);
        }
      }
      log(evtType, text, t, vtime);
      lastEventType = evt.type;
      skippedTimeUpdates = 0;
    } else {
      skippedTimeUpdates++;
    }
  };

  const getStats = () => {
    const stats = video.getVideoPlaybackQuality();
    let dropped = 'N/A';
    if (stats.totalVideoFrames) {
      dropped = `${Math.round(100*stats.droppedVideoFrames/stats.totalVideoFrames)}%`;
    }

    let segmentLength = 'N/A', maxNumber = 0;
    for (let segment in increments) {
      if (increments[segment] > maxNumber) {
        segmentLength = `${segment}s`;
        maxNumber = increments[segment];
      }
    }

    return {
      creationTime: `${Math.round(stats.creationTime)}ms`,
      droppedVideoFrames: `${dropped}`,
      segmentLength: `${segmentLength}`,
      increments: increments,
      error: video.error,
      videoInfo: getTrackInfo(),
    }

  };

  const addMessageListener = () => {
    if (window?.MediaKeys?.prototype?.createSession) {
      MediaKeys.prototype._createSession = MediaKeys.prototype.createSession;
      MediaKeys.prototype.createSession = function(type = 'temporary') {
        const session = this._createSession(type);
        session.addEventListener('message', debug);
        session.addEventListener('keystatuseschange', debug);
        return session;
      }
      MediaKeySession.prototype._close = MediaKeySession.prototype.close;
      MediaKeySession.prototype.close = function() {
        this.removeEventListener('message', debug);
        this.removeEventListener('keystatuseschange', debug);
        this._close();
      }
    }
  }

  const removeMessageListener = () => {
    if (window?.MediaKeys?.prototype?.createSession) {
      MediaKeys.prototype.createSession = MediaKeys.prototype._createSession;
      MediaKeySession.prototype.close = MediaKeySession.prototype._close;
    }
  };

  const addEventListeners = videoElement => {
    video = videoElement;
    playerEvents.forEach(evtType => video.addEventListener(evtType, debug));
    addMessageListener();
  };

  const removeEventListeners = () => {
    playerEvents.forEach(evtType => video.removeEventListener(evtType, debug));
    removeMessageListener();
  };

  const checkpoint = text => debug({type: 'checkpoint', text: text});

  return {
    addEventListeners: addEventListeners,
    removeEventListeners: removeEventListeners,
    eventHistory: eventHistory,
    pastEventHistory: pastEventHistory,
    checkpoint: checkpoint,
    getStats: getStats,
    resetTime: resetTime
  };

};
export default Html5playerDebug;
