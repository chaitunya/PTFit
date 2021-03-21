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

async function loadVideo() {
  const video = await setupCamera();
  // const video = document.getElementById('video');
  video.play();

  return video;
}

const defaultQuantBytes = 2;

const defaultMobileNetMultiplier = isMobile() ? 0.50 : 0.75;
const defaultMobileNetStride = 16;
const defaultMobileNetInputResolution = 500;

const defaultResNetMultiplier = 1.0;
const defaultResNetStride = 32;
const defaultResNetInputResolution = 250;

const guiState = {
  algorithm: 'multi-pose',
  input: {
    architecture: 'MobileNetV1',
    outputStride: defaultMobileNetStride,
    inputResolution: defaultMobileNetInputResolution,
    multiplier: defaultMobileNetMultiplier,
    quantBytes: defaultQuantBytes
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  multiPoseDetection: {
    maxPoseDetections: 5,
    minPoseConfidence: 0.15,
    minPartConfidence: 0.1,
    nmsRadius: 30.0,
  },
  output: {
    showVideo: true,
    showSkeleton: true,
    showPoints: true,
    showBoundingBox: false,
  },
  net: null,
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui(cameras, net) {
  guiState.net = net;
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
  // stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
  // document.getElementById('main').appendChild(stats.dom);
  var startElement = document.getElementById('start');

  startElement.onclick = function () {
    alert("button pressed :g_:");

  };
  document.getElementById('end').onclick = function () {
    alert("ya so like do et oren");

  };
  document.getElementById('recommendation').onclick = function () {
    alert("Change button pressed :juicert:");
    document.getElementById('recommendation-text').innerHTML = 'hello';
  };
}
