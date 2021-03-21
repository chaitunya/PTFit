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
    alert("button pressed");

  };
  document.getElementById('end').onclick = function () {
    alert("ya so like");

  };
  document.getElementById('recommendation').onclick = function () {
    alert("Change button pressed");
    document.getElementById('recommendation-text').innerHTML = 'hello';
  };
}


function drawVideo(video, keypoints, minPartConfidence, ctx) {
  ctx.clearRect(0, 0, videoWidth, videoHeight);
  if (guiState.output.showVideo) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-videoWidth, 0);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    ctx.restore();
  }


}

function clearCanvas(video, net, ctx) {
  ctx.clearRect(0, 0, videoWidth, videoHeight);
  if (guiState.output.showVideo) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-videoWidth, 0);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    ctx.restore();
  }
}

function wait(ms) {
    var start = Date.now(),
        now = start;
    while (now - start < ms) {
      now = Date.now();
    }
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  // since images are being fed from a webcam, we want to feed in the
  // original image and then just flip the keypoints' x coordinates. If instead
  // we flip the image, then correcting left-right keypoint pairs requires a
  // permutation on all the keypoints.
  const flipPoseHorizontal = true;

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  var ctr = 0;
  var numElapsedFrames = 0;
  var calibrate = true;
  const numCalibrateFrames = 5;
  const numRTframes = 5;
  var lengths_user_rt;
  var framectr_calibrate = 0;
  var framectr_rt = 0;
  var calibration_poses = {};
  var all_poses = {}

  async function poseDetectionFrame() {
    // Begin monitoring code for frames per second
    stats.begin();

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    let all_the_poses = await guiState.net.estimatePoses(video, {
      flipHorizontal: flipPoseHorizontal,
      decodingMethod: 'multi-person',
      maxDetections: guiState.multiPoseDetection.maxPoseDetections,
      scoreThreshold: guiState.multiPoseDetection.minPartConfidence,
      nmsRadius: guiState.multiPoseDetection.nmsRadius
    });

    poses = poses.concat(all_the_poses);
    minPoseConfidence = +guiState.multiPoseDetection.minPoseConfidence;
    minPartConfidence = +guiState.multiPoseDetection.minPartConfidence;

    clearCanvas(video, net, ctx);

    if (calibrate) {
      if (numElapsedFrames == 5) {
        alert("Please match your skeleton to the pose shown");
      }
      drawKeypoints(raw_poses_user["frame_1"], minPartConfidence, ctx);
      drawTrainerSkeleton(raw_poses_user["frame_1"], minPartConfidence, ctx, 'trainer');
    }

    // For each pose (i.e. person) detected in an image, loop through the poses
    // and draw the resulting skeleton and keypoints if over certain confidence
    // scores
    // console.log(Object.keys(poses).length);
    var referencePoint;
    poses.forEach(({score, keypoints}) => {
      if (score >= minPoseConfidence) {
        referencePoint = keypoints[6].position;
        var numParts = 0;

        if (!calibrate) {
          all_poses['frame_' + framectr_rt.toString()] = keypoints;
          lengths_user_rt = calculateLengths(all_poses);
          framectr_rt = (framectr_rt + 1) % numRTframes
        } else {
          for (var i=0;i<keypoints.length;i++) {
            var bodyPart = keypoints[i];

            if (bodyPart["score"] >= 0.20 && i >= 5) {
              numParts += 1;
            }
          }
          console.log(numParts);
          if (numParts == 12) {
            calibration_poses['frame_' + framectr_calibrate.toString()] = keypoints;
            framectr_calibrate += 1;
            if (framectr_calibrate == numCalibrateFrames) {
              calibrate = false;
              // console.log( JSON.stringify(calibration_poses));
              //
              // console.log( "LENGTHS: ");
              // console.log( JSON.stringify(lengths_user_rt));
              alert("Calibration complete. Let's start the exercise!");
              all_poses = calibration_poses;
              lengths_user_rt = calculateLengths(all_poses);
            }
          }
        }
        drawKeypoints(keypoints, minPartConfidence, ctx);
        drawSkeleton(keypoints, minPartConfidence, ctx);
      }
    });



    //keypoints_trainer = transformKeypoints(keypoints_trainer, trainerRefPoint);
    if (!calibrate) {
      var keypoints_trainer = raw_poses_trainer["frame_"+ctr.toString()];
      var trainerRefPoint = keypoints_trainer[6];

      //console.log( JSON.stringify(lengths_user_rt));
      //alert("scaling");
      if (typeof(trainerRefPoint) != "undefined" && typeof(referencePoint) != "undefined") {
        var scaleFactor = lengths_user_rt["right_upper_arm"][2] / lengths_trainer["right_upper_arm"][2];
        console.log("SCALE FACTOR: ");
        console.log(scaleFactor);
        trainerRefPoint["position"]["x"] *= scaleFactor;
        trainerRefPoint["position"]["y"] *= scaleFactor;
        var shiftX = referencePoint["x"] - trainerRefPoint["position"]["x"];
        var shiftY = referencePoint["y"] - trainerRefPoint["position"]["y"];

        for (var i=0;i<keypoints_trainer.length;i++) {
          if (keypoints_trainer[i]["part"] != "rightShoulder") {
            keypoints_trainer[i]["position"]["x"] *= scaleFactor;
            keypoints_trainer[i]["position"]["y"] *= scaleFactor;
          }
          keypoints_trainer[i]["position"]["x"] += shiftX;
          keypoints_trainer[i]["position"]["y"] += shiftY;
        }
      }

      drawTrainerSkeleton(keypoints_trainer, minPartConfidence, ctx, 'trainer');
    }


    // End monitoring code for frames per second
    stats.end();

    ctr = (ctr + 1) % (Object.keys(raw_poses_trainer).length);
    numElapsedFrames = (numElapsedFrames + 1) % 1000;
    // setTimeout(() => {  console.log("COUNTER: ", ctr);  }, 5);
    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}


/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */
export async function bindPage() {
  toggleLoadingUI(true);
  const net = await posenet.load({
    architecture: guiState.input.architecture,
    outputStride: guiState.input.outputStride,
    inputResolution: guiState.input.inputResolution,
    multiplier: guiState.input.multiplier,
    quantBytes: guiState.input.quantBytes
  });
  toggleLoadingUI(false);

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
        'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }

  setupGui([], net);
  setupFPS();
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo
bindPage();
 