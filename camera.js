import * as posenet from '@tensorflow-models/posenet';
import fs from 'fs';
import dat from 'dat.gui';
import Stats from 'stats.js';
import raw_poses_trainer from './raw_poses_trainer.json';
import raw_poses_user from './raw_poses_user.json';
import lengths_trainer from './lengths_trainer.json';
import lengths_user from './lengths_user.json';

import {drawBoundingBox, drawKeypoints, drawSkeleton, isMobile, toggleLoadingUI, tryResNetButtonName, tryResNetButtonText, updateTryResNetButtonDatGuiCss, calculateLengths, drawTrainerSkeleton} from './demo_util';

const videoWidth = 700;
const videoHeight = Math.round(videoWidth * (500/600));
const stats = new Stats();

// Factors that change per exercise: refernce body part/segment, point name to take as "origin"
var exercises = {
  "Arm Curls": ["right_upper_arm", "rightShoulder"],
  "Pushups": []
}

// var fs = require('browserify-fs');

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined : videoWidth,
      height: mobile ? undefined : videoHeight,
    },
  });
  video.srcObject = stream;
  // video.src = "train.mp4";

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}
