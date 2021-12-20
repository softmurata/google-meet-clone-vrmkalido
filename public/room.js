const socket = io();
const myvideo = document.querySelector("#vd1");
const roomid = params.get("room");
let username;
const chatRoom = document.querySelector('.chat-cont');
const sendButton = document.querySelector('.chat-send');
const messageField = document.querySelector('.chat-input');
const videoContainer = document.querySelector('#vcont');
const overlayContainer = document.querySelector('#overlay')
const continueButt = document.querySelector('.continue-name');
const nameField = document.querySelector('#name-field');
const videoButt = document.querySelector('.novideo');
const audioButt = document.querySelector('.audio');
const cutCall = document.querySelector('.cutcall');
const screenShareButt = document.querySelector('.screenshare');



/* mediapipe */

const videoWidth = 640;
const videoHeight = 480;

// canvas settings
const mediapipeCanvas = document.createElement("canvas");
mediapipeCanvas.width = videoWidth;
mediapipeCanvas.height = videoHeight;
const mediapipeCtx = mediapipeCanvas.getContext("2d");

function onResults(results){
    mediapipeCtx.save();
    mediapipeCtx.clearRect(0, 0, mediapipeCanvas.width, mediapipeCanvas.height);

    // Only overwrite existing pixels.
    mediapipeCtx.globalCompositeOperation = 'source-in';
    mediapipeCtx.fillStyle = '#00FF00';
    mediapipeCtx.fillRect(0, 0, mediapipeCanvas.width, mediapipeCanvas.height);

    // Only overwrite missing pixels.
    mediapipeCtx.globalCompositeOperation = 'destination-atop';
    mediapipeCtx.drawImage(
        results.image, 0, 0, mediapipeCanvas.width, mediapipeCanvas.height);

    mediapipeCtx.globalCompositeOperation = 'source-over';
    drawConnectors(mediapipeCtx, results.poseLandmarks, POSE_CONNECTIONS,
                    {color: '#00FF00', lineWidth: 4});
    drawLandmarks(mediapipeCtx, results.poseLandmarks,
                    {color: '#FF0000', lineWidth: 2});
    drawConnectors(mediapipeCtx, results.faceLandmarks, FACEMESH_TESSELATION,
                    {color: '#C0C0C070', lineWidth: 1});
    drawConnectors(mediapipeCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
                    {color: '#CC0000', lineWidth: 5});
    drawLandmarks(mediapipeCtx, results.leftHandLandmarks,
                    {color: '#00FF00', lineWidth: 2});
    drawConnectors(mediapipeCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
                    {color: '#00CC00', lineWidth: 5});
    drawLandmarks(mediapipeCtx, results.rightHandLandmarks,
                    {color: '#FF0000', lineWidth: 2});
    mediapipeCtx.restore();

    animateVRM(currentVrm, results);

}

/* ThreeJS Settings */
const remap = Kalidokit.Utils.remap;
const clamp = Kalidokit.Utils.clamp;
const lerp = Kalidokit.Vector.lerp;

let currentVrm;

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(640, 480);
renderer.setPixelRatio(window.devicePixelRatio);

const orbitCamera = new THREE.PerspectiveCamera(35, videoWidth / videoHeight, 0.1, 1000);
orbitCamera.position.set(0.0, 1.4, 1.4);

const orbitControls = new THREE.OrbitControls(orbitCamera, renderer.domElement);
orbitControls.screenSpacePanning = true;
orbitControls.target.set(0.0, 1.4, 0.0);
orbitControls.update();

const scene = new THREE.Scene();

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

const clock = new THREE.Clock();

function animate(){
    requestAnimationFrame(animate);

    if (currentVrm){
        currentVrm.update(clock.getDelta())
    }

    renderer.render(scene, orbitCamera)
}

animate()

// vrm loader
const loader = new THREE.GLTFLoader();
loader.crossOrigin = "anonymous";



// getMediapipeStream

const videoElement = document.createElement("video");


function getMediapipeStream(localstream, video, audio){
    const holistic = new Holistic({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    }});
    
    
    holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: true,
        smoothSegmentation: true,
        refineFaceLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    holistic.onResults(onResults);

    videoElement.srcObject = localstream;

    const camera = new Camera(videoElement, {
        onFrame: async() => {
            await holistic.send({image: videoElement})
        },
        width: videoWidth,
        height: videoHeight
    })

    camera.start();

    let mediapipestream = new MediaStream();

    if (video){
        // mediapipeCanvas.captureStream().getTracks().forEach((track) => {
        //     mediapipestream.addTrack(track);
        // })

        renderer.domElement.captureStream().getTracks().forEach((track) => {
            mediapipestream.addTrack(track);
        })

    }

    if (audio){
        localstream.getTracks().forEach((track) => {
            mediapipestream.addTrack(track);
        })
    }

    return mediapipestream
    
}


/* animate VRM model part */
const animateVRM = (vrm, results) => {
    if (!vrm){
        return;
    }

    // Initialize pose data
    let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;

    // get mediapipe results
    const faceLandmarks = results.faceLandmarks;
    const pose3DLandmarks = results.ea;
    const pose2DLandmarks = results.poseLandmarks;
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;

    // animate face
    if (faceLandmarks){
        riggedFace = Kalidokit.Face.solve(faceLandmarks, {
            runtime: "mediapipe",
            video: videoElement
        })

        rigFace(riggedFace)
    }

    // animate Pose
    if (pose3DLandmarks && pose2DLandmarks){

        riggedPose = Kalidokit.Pose.solve(pose3DLandmarks, pose2DLandmarks, {
            runtime: "mediapipe",
            video: videoElement
        })

        rigRotation("Hips", riggedPose.Hips.rotation, 0.7);
        rigPosition(
            "Hips",
            {
                x: -riggedPose.Hips.worldPosition.x,
                y: riggedPose.Hips.worldPosition.y + 1,
                z: -riggedPose.Hips.worldPosition.z
            },
            1, 
            0.07
        );

        rigRotation("Chest", riggedPose.Spine, 0.25, 0.3);
        rigRotation("Spine", riggedPose.Spine, 0.45, 0.3);

        rigRotation("RightUpperArm", riggedPose.RightUpperArm, 1, 0.3);
        rigRotation("RightLowerArm", riggedPose.RightLowerArm, 1, 0.3);
        rigRotation("LeftUpperArm", riggedPose.LeftUpperArm, 1, 0.3);
        rigRotation("LeftLowerArm", riggedPose.LeftLowerArm, 1, 0.3);

        rigRotation("RightUpperLeg", riggedPose.RightUpperLeg, 1, 0.3);
        rigRotation("RightLowerLeg", riggedPose.RightLowerLeg, 1, 0.3);
        rigRotation("LeftUpperLeg", riggedPose.LeftUpperLeg, 1, 0.3);
        rigRotation("LeftLowerLeg", riggedPose.LeftLowerLeg, 1, 0.3);

    }

    // animate hand pose
    if (leftHandLandmarks){
        riggedLeftHand = Kalidokit.Hand.solve(leftHandLandmarks, "Left")

        rigRotation("LeftHand", {
            z: riggedPose.LeftHand.z,
            y: riggedLeftHand.LeftWrist.y,
            x: riggedLeftHand.LeftWrist.x,
        });

        rigRotation("LeftRingProximal", riggedLeftHand.LeftRingProximal);
        rigRotation("LeftRingIntermediate", riggedLeftHand.LeftRingIntermediate);
        rigRotation("LeftRingDistal", riggedLeftHand.LeftRingDistal);
        rigRotation("LeftIndexProximal", riggedLeftHand.LeftIndexProximal);
        rigRotation("LeftIndexIntermediate", riggedLeftHand.LeftIndexIntermediate);
        rigRotation("LeftIndexDistal", riggedLeftHand.LeftIndexDistal);
        rigRotation("LeftMiddleProximal", riggedLeftHand.LeftMiddleProximal);
        rigRotation("LeftMiddleIntermediate", riggedLeftHand.LeftMiddleIntermediate);
        rigRotation("LeftMiddleDistal", riggedLeftHand.LeftMiddleDistal);
        rigRotation("LeftThumbProximal", riggedLeftHand.LeftThumbProximal);
        rigRotation("LeftThumbIntermediate", riggedLeftHand.LeftThumbIntermediate);
        rigRotation("LeftThumbDistal", riggedLeftHand.LeftThumbDistal);
        rigRotation("LeftLittleProximal", riggedLeftHand.LeftLittleProximal);
        rigRotation("LeftLittleIntermediate", riggedLeftHand.LeftLittleIntermediate);
        rigRotation("LeftLittleDistal", riggedLeftHand.LeftLittleDistal);
    }

    if (rightHandLandmarks){
        riggedRightHand = Kalidokit.Hand.solve(rightHandLandmarks, "Right")

        rigRotation("RightHand", {
            z: riggedPose.RightHand.z,
            y: riggedRightHand.RightWrist.y,
            x: riggedRightHand.RightWrist.x,
        });
        
        rigRotation("RightRingProximal", riggedRightHand.RightRingProximal);
        rigRotation("RightRingIntermediate", riggedRightHand.RightRingIntermediate);
        rigRotation("RightRingDistal", riggedRightHand.RightRingDistal);
        rigRotation("RightIndexProximal", riggedRightHand.RightIndexProximal);
        rigRotation("RightIndexIntermediate", riggedRightHand.RightIndexIntermediate);
        rigRotation("RightIndexDistal", riggedRightHand.RightIndexDistal);
        rigRotation("RightMiddleProximal", riggedRightHand.RightMiddleProximal);
        rigRotation("RightMiddleIntermediate", riggedRightHand.RightMiddleIntermediate);
        rigRotation("RightMiddleDistal", riggedRightHand.RightMiddleDistal);
        rigRotation("RightThumbProximal", riggedRightHand.RightThumbProximal);
        rigRotation("RightThumbIntermediate", riggedRightHand.RightThumbIntermediate);
        rigRotation("RightThumbDistal", riggedRightHand.RightThumbDistal);
        rigRotation("RightLittleProximal", riggedRightHand.RightLittleProximal);
        rigRotation("RightLittleIntermediate", riggedRightHand.RightLittleIntermediate);
        rigRotation("RightLittleDistal", riggedRightHand.RightLittleDistal);
    }


}

// Helper function
// rotation
const rigRotation = (name, rotation = { x: 0, y: 0, z: 0}, dampener = 1, lerpAmount = 0.3) => {
    if (!currentVrm){
        return;
    }

    const Part = currentVrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[name]);

    if (!Part){
        return;
    }

    let euler = new THREE.Euler(rotation.x * dampener, rotation.y * dampener, rotation.z * dampener);
    let quaternion = new THREE.Quaternion().setFromEuler(euler);
    Part.quaternion.slerp(quaternion, lerpAmount);  // interpolate
}

// position
const rigPosition = (name, position = { x: 0, y: 0, z: 0}, dampener = 1, lerpAmount = 0.3) => {
    if (!currentVrm){
        return;
    }

    const Part = currentVrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[name]);
    if (!Part) {
        return;
    }

    let vector = new THREE.Vector3(position.x * dampener, position.y * dampener, position.z * dampener);
    Part.position.lerp(vector, lerpAmount);
}

// animate face
let oldLookTarget = new THREE.Euler();

const rigFace = (riggedFace) => {
    if (!currentVrm){
        return;
    }
    rigRotation("Neck", riggedFace.head, 0.7);

    // BlendShapes and Preset Name Schema
    const Blendshape = currentVrm.blendShapeProxy;
    const PresetName = THREE.VRMSchema.BlendShapePresetName;

    // Simple example without winking. Interpolate based on old blendshape, then stabilize blink with `Kalidokit` helper function.
    // for VRM, 1 is closed, 0 is open.
    riggedFace.eye.l = lerp(clamp(1 - riggedFace.eye.l, 0, 1), Blendshape.getValue(PresetName.Blink), 0.5);
    riggedFace.eye.r = lerp(clamp(1 - riggedFace.eye.r, 0, 1), Blendshape.getValue(PresetName.Blink), 0.5);
    riggedFace.eye = Kalidokit.Face.stabilizeBlink(riggedFace.eye, riggedFace.head.y);
    Blendshape.setValue(PresetName.Blink, riggedFace.eye.l);

    // Interpolate and set mouth blendshapes
    Blendshape.setValue(PresetName.I, lerp(riggedFace.mouth.shape.I, Blendshape.getValue(PresetName.I), 0.5));
    Blendshape.setValue(PresetName.A, lerp(riggedFace.mouth.shape.A, Blendshape.getValue(PresetName.A), 0.5));
    Blendshape.setValue(PresetName.E, lerp(riggedFace.mouth.shape.E, Blendshape.getValue(PresetName.E), 0.5));
    Blendshape.setValue(PresetName.O, lerp(riggedFace.mouth.shape.O, Blendshape.getValue(PresetName.O), 0.5));
    Blendshape.setValue(PresetName.U, lerp(riggedFace.mouth.shape.U, Blendshape.getValue(PresetName.U), 0.5));

    //PUPILS
    //interpolate pupil and keep a copy of the value
    let lookTarget = new THREE.Euler(
        lerp(oldLookTarget.x, riggedFace.pupil.y, 0.4),
        lerp(oldLookTarget.y, riggedFace.pupil.x, 0.4),
        0,
        "XYZ"
    );
    oldLookTarget.copy(lookTarget);
    currentVrm.lookAt.applyer.lookAt(lookTarget);

}



// video stream part

let videoAllowed = 1;
let audioAllowed = 1;

let videoInfo = {};
let micInfo = {};

let videoTrackReceived = {};

let mymuteicon = document.querySelector("#mymuteicon");
mymuteicon.style.visibility = "hidden";

let myvideooff = document.querySelector("#myvideooff");
myvideooff.style.visibility = "hidden";

// turn server configuration
const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] }

// required global variables
let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};

let mystream, myscreenshare;


// enter name before staring video meeting
document.querySelector('.roomcode').innerHTML = `${roomid}`

function CopyClassText(){
    var textToCopy = document.querySelector('.roomcode');
    var currentRange;
    if (document.getSelection().rangeCount > 0) {
        currentRange = document.getSelection().getRangeAt(0);
        window.getSelection().removeRange(currentRange);
    }
    else {
        currentRange = false;
    }

    var CopyRange = document.createRange();
    CopyRange.selectNode(textToCopy);
    window.getSelection().addRange(CopyRange);
    document.execCommand("copy");

    window.getSelection().removeRange(CopyRange);

    if (currentRange) {
        window.getSelection().addRange(currentRange);
    }

    document.querySelector(".copycode-button").textContent = "Copied!"
    setTimeout(()=>{
        document.querySelector(".copycode-button").textContent = "Copy Code";
    }, 5000);
}

const deployURL = "http://localhost:3000"

continueButt.addEventListener('click', async () => {
    if (nameField.value == '') return;
    username = nameField.value;
    overlayContainer.style.visibility = 'hidden';
    document.querySelector("#myname").innerHTML = `${username} (You)`;
    socket.emit("join room", roomid, username);

    let fileurl = undefined // "https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981";

    if (nameField.value !== ""){
        let vrmvariables = {
            username: nameField.value
        }
        let response = await axios.post(`${deployURL}/api/preview/getvrm`, vrmvariables);
        console.log(response.data.result[0].url);

        fileurl = response.data.result[0].url;
    }

    loader.load(fileurl,
        (gltf) => {
            THREE.VRMUtils.removeUnnecessaryJoints(gltf.scene);
            THREE.VRM.from(gltf).then((vrm) => {
                scene.add(vrm.scene);
                currentVrm = vrm;
                currentVrm.scene.rotation.y = Math.PI;
            });
        },

        (progress) => console.log("Loading model...", 100.0 * (progress.loaded / progress.total), "%"),

        (error) => console.error(error)
    );

})

nameField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        continueButt.click();
    }
});

// Error handling function
function handleGetUserMediaError(e){
    switch (e.name) {
        case "NotFoundError":
            alert("Unable to open your call because no camera and/or microphone" +
                "were found.");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
            break;
    }

}

function reportError(e) {
    console.log(e);
    return;
}


let peerConnection;
let mediaConstraints = { video: true, audio: true }

// screen share code
//Thanks to (https://github.com/miroslavpejic85) for ScreenShare Code

screenShareButt.addEventListener('click', () => {
    screenShareToggle();
});
let screenshareEnabled = false;
function screenShareToggle() {
    let screenMediaPromise;
    if (!screenshareEnabled) {
        if (navigator.getDisplayMedia) {
            screenMediaPromise = navigator.getDisplayMedia({ video: true });
        } else if (navigator.mediaDevices.getDisplayMedia) {
            screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            screenMediaPromise = navigator.mediaDevices.getUserMedia({
                video: { mediaSource: "screen" },
            });
        }
    } else {
        screenMediaPromise = navigator.mediaDevices.getUserMedia({ video: true });
    }
    screenMediaPromise
        .then((myscreenshare) => {
            screenshareEnabled = !screenshareEnabled;
            for (let key in connections) {
                const sender = connections[key]
                    .getSenders()
                    .find((s) => (s.track ? s.track.kind === "video" : false));
                sender.replaceTrack(myscreenshare.getVideoTracks()[0]);
            }
            myscreenshare.getVideoTracks()[0].enabled = true;
            const newStream = new MediaStream([
                myscreenshare.getVideoTracks()[0], 
            ]);
            myvideo.srcObject = newStream;
            myvideo.muted = true;
            mystream = newStream;
            screenShareButt.innerHTML = (screenshareEnabled 
                ? `<i class="fas fa-desktop"></i><span class="tooltiptext">Stop Share Screen</span>`
                : `<i class="fas fa-desktop"></i><span class="tooltiptext">Share Screen</span>`
            );
            myscreenshare.getVideoTracks()[0].onended = function() {
                if (screenshareEnabled) screenShareToggle();
            };
        })
        .catch((e) => {
            alert("Unable to share screen:" + e.message);
            console.error(e);
        });
}



/* socket event handler part */

function startCall(){
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {
        // write getMediapipeStream()
        let mstream = getMediapipeStream(localstream, true, true)
        myvideo.srcObject = mstream;
        myvideo.muted = true;

        
        mstream.getTracks().forEach((track) => {
            for (let key in connections){
                connections[key].addTrack(track, localstream);
                if (track.kind === "audio"){
                    audioTrackSent[key] = track
                } else {
                    videoTrackSent[key] = track
                }
            }
        })
        
    })
    .catch(handleGetUserMediaError);
}


function handleVideoOffer(offer, sid, cname, micinf, vidinf){
    console.log('video offered recevied');
    cName[sid] = cname;
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;

    // create new peer connection
    connections[sid] = new RTCPeerConnection(configuration);

    connections[sid].onicecandidate = function(e){
        if (e.candidate){
            console.log('icecandidate fired');
            socket.emit("new icecandidate", e.candidate, sid);
        }
    }

    connections[sid].ontrack = function(e){
        if (!document.getElementById(sid)){
            console.log("track event fired");
            let vidCont = document.createElement('div');
            let newvideo = document.createElement('video');
            let name = document.createElement('div');
            let muteIcon = document.createElement('div');
            let videoOff = document.createElement('div');

            videoOff.classList.add("video-off");
            muteIcon.classList.add("mute-icon");
            name.classList.add("nametag");
            name.innerHTML = `${cName[sid]}`;
            vidCont.id = sid;
            muteIcon.id = `mute${sid}`;
            videoOff.id = `vidoff${sid}`;
            muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
            videoOff.innerHTML = 'Video Off'
            vidCont.classList.add('video-box');

            newvideo.classList.add("video-frame");
            newvideo.autoplay = true;
            newvideo.playsInline = true;
            newvideo.id = `video${sid}`;
            newvideo.srcObject = e.streams[0];


            if (micInfo[sid] == "on"){
                muteIcon.style.visibility = 'hidden';
            } else {
                muteIcon.style.visibility = 'visible';
            }

            if (videoInfo[sid] == "on"){
                videoOff.style.visibility = 'hidden';
            } else {
                videoOff.style.visibility = 'visible';
            }

            // create new videoCont
            vidCont.appendChild(newvideo);
            vidCont.appendChild(name);
            vidCont.appendChild(muteIcon);
            vidCont.appendChild(videoOff);


            videoContainer.appendChild(vidCont);

        }
    };

    connections[sid].onremovetrack = function(e){
        if (document.getElementById(sid)){
            document.getElementById(sid).remove();
            console.log('removed a track');
        }
    };

    connections[sid].onnegotiationneeded = function(){
        connections[sid].createOffer()
        .then(offer => {
            return connections[sid].serLocalDescription(offer);
        })
        .then(() => {
            socket.emit("video-offer", connections[sid].localDescription, sid);
        })
        .catch(reportError)

    };


    // set remote peerconnection
    let desc = new RTCSessionDescription(offer);

    connections[sid].setRemoteDescription(desc)
    .then(() => { return navigator.mediaDevices.getUserMedia(mediaConstraints) })
    .then((localStream) => {

        // write getMediapipeStream()
        let mstream = getMediapipeStream(localStream, true, true);

        mstream.getTracks().forEach((track) => {
            connections[sid].addTrack(track, localStream);
            console.log('added local stream to peer')
            if (track.kind === 'audio') {
                audioTrackSent[sid] = track;
                if (!audioAllowed)
                    audioTrackSent[sid].enabled = false;
            }
            else {
                videoTrackSent[sid] = track;
                if (!videoAllowed)
                    videoTrackSent[sid].enabled = false
            }

        })
    })
    .then(() => {
        return connections[sid].createAnswer();
    })
    .then((answer) => {
        return connections[sid].setLocalDescription(answer);
    })
    .then(() => {
        socket.emit("video-answer", connections[sid].localDescription, sid);
    })
    .catch(handleGetUserMediaError);

}

function handleNewIceCandidate(candidate, sid) {
    console.log('new candidate recieved')
    var newcandidate = new RTCIceCandidate(candidate);

    connections[sid].addIceCandidate(newcandidate)
        .catch(reportError);
}

function handleVideoAnswer(answer, sid) {
    console.log('answered the offer')
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans);
}


async function handleJoinRoom(conc, cnames, micinfo, videoinfo){
    socket.emit("getCanvas");
    if (cnames)
        cName = cnames;

    if (micinfo)
        micInfo = micinfo;

    if (videoinfo)
        videoInfo = videoinfo;


    console.log(cName);

    if (conc){
        await conc.forEach(sid => {
            // reference: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
            // create new RTC peerconnection
            connections[sid] = new RTCPeerConnection(configuration);

            // interactive connectivity establishment(ICE)
            connections[sid].onicecandidate = function(e){
                if (e.candidate){
                    console.log('icecandidate fired');
                    socket.emit("new icecandidate", e.candidate, sid);
                }
            }

            // if the first stream is in the incoming track
            connections[sid].ontrack = function(e){
                if (!document.getElementById(sid)) {
                    console.log('track event fired')
                    let vidCont = document.createElement('div');
                    let newvideo = document.createElement('video');
                    let name = document.createElement('div');
                    let muteIcon = document.createElement('div');
                    let videoOff = document.createElement('div');
                    videoOff.classList.add('video-off');
                    muteIcon.classList.add('mute-icon');
                    name.classList.add('nametag');
                    name.innerHTML = `${cName[sid]}`;
                    vidCont.id = sid;
                    muteIcon.id = `mute${sid}`;
                    videoOff.id = `vidoff${sid}`;
                    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                    videoOff.innerHTML = 'Video Off'
                    vidCont.classList.add('video-box');
                    newvideo.classList.add('video-frame');
                    newvideo.autoplay = true;
                    newvideo.playsinline = true;
                    newvideo.id = `video${sid}`;
                    newvideo.srcObject = event.streams[0];

                    if (micInfo[sid] == 'on')
                        muteIcon.style.visibility = 'hidden';
                    else
                        muteIcon.style.visibility = 'visible';

                    if (videoInfo[sid] == 'on')
                        videoOff.style.visibility = 'hidden';
                    else
                        videoOff.style.visibility = 'visible';

                    vidCont.appendChild(newvideo);
                    vidCont.appendChild(name);
                    vidCont.appendChild(muteIcon);
                    vidCont.appendChild(videoOff);

                    videoContainer.appendChild(vidCont);

                }
            };


            // remove track
            connections[sid].onremovetrack = function (event) {
                if (document.getElementById(sid)) {
                    document.getElementById(sid).remove();
                }
            }

            connections[sid].onnegotiationneeded = function () {

                connections[sid].createOffer()
                    .then(function (offer) {
                        return connections[sid].setLocalDescription(offer);
                    })
                    .then(function () {

                        // send the offer to the remote peer connection to signaling server
                        socket.emit('video-offer', connections[sid].localDescription, sid);

                    })
                    .catch(reportError);
            };
        })

        console.log('added all sockets to connections');
        startCall();

    } else {
        console.log('waiting for someone to join');
        navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(localStream => {
            // write getMediapipeStream()
            let mstream = getMediapipeStream(localStream, true, true);
            myvideo.srcObject = mstream;
            myvideo.muted = true;
            mystream = mstream;
        })
        .catch(handleGetUserMediaError)

    }

}

function handleRemovePeer(sid){
    if (document.getElementById(sid)){
        document.getElementById(sid).remove();
    }

    delete connections[sid]
}

function handleMessage(msg, sendername, time){
    chatRoom.scrollTop = chatRoom.scrollHeight;
    chatRoom.innerHTML += `<div class="message">
    <div class="info">
        <div class="username">${sendername}</div>
        <div class="time">${time}</div>
    </div>
    <div class="content">
        ${msg}
    </div>
</div>`
}


function handleAction(msg, sid){
    if (msg === "mute"){
        console.log(sid + ' muted themself');
        document.querySelector(`#mute${sid}`).style.visibility = 'visible';
        micInfo[sid] = "off";
    } else if (msg === "unmute"){
        console.log(sid + ' unmuted themself');
        document.querySelector(`#mute${sid}`).style.visibility = 'hidden';
        micInfo[sid] = "on";
    } else if (msg === "videooff"){
        console.log(sid + 'turned video off');
        document.querySelector(`#vidoff${sid}`).style.visibility = 'visible';
        videoInfo[sid] = 'off';
    } else if (msg === "videoon"){
        console.log(sid + 'turned video on');
        document.querySelector(`#vidoff${sid}`).style.visibility = 'hidden';
        videoInfo[sid] = 'on';
    }

}

function handleUseerCount(count){
    if (count > 1){
        videoContainer.className = 'video-cont';
    } else {
        videoContainer.className = 'video-cont-single';
    }

}

// socket
socket.on("video-offer", handleVideoOffer);
socket.on("new icecandidate", handleNewIceCandidate);
socket.on("video-answer", handleVideoAnswer);
socket.on("join room", handleJoinRoom);
socket.on("message", handleMessage);
socket.on("remove peer", handleRemovePeer);
socket.on("action", handleAction);
socket.on("user count", handleUseerCount)


/* chat message part */
sendButton.addEventListener('click', () => {
    const msg = messageField.value;
    messageField.value = '';
    socket.emit('message', msg, username, roomid);
})

messageField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        sendButton.click();
    }
});

/* icon button click event handler */

// video icon
videoButt.addEventListener("click", () => {
    if (videoAllowed){
        // disable video
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = false;
        }
        videoButt.innerHTML = `<i class="fas fa-video-slash"></i>`;
        videoAllowed = 0;
        videoButt.style.backgroundColor = "#b12c2c";

        if (mystream){
            mystream.getTracks().forEach((track) => {
                if (track.kind === "video"){
                    track.enabled = false;
                }
            })
        }

        myvideooff.style.visibility = 'visible';
        socket.emit("action", "videooff");

    } else {
        // enable video
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = true;
        }
        videoButt.innerHTML = `<i class="fas fa-video"></i>`;
        videoAllowed = 1;
        videoButt.style.backgroundColor = "#4ECCA3";

        if (mystream){
            mystream.getTracks().forEach((track) => {
                if (track.kind === "video"){
                    track.enabled = true;
                }
            })
        }

        myvideooff.style.visibility = 'hidden';
        socket.emit("action", "videoon");


    }
})

// audio icon
audioButt.addEventListener("click", () => {
    if (audioAllowed){
        // disable audio
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = false;
        }
        audioButt.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        audioAllowed = 0;
        audioButt.style.backgroundColor = "#b12c2c";

        if (mystream){
            mystream.getTracks().forEach((track) => {
                if (track.kind === "audio"){
                    track.enabled = false;
                }
            })
        }

        mymuteicon.style.visibility = "visible";
        socket.emit("action", "mute")

    } else {
        // enable audio
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = true;
        }
        audioButt.innerHTML = `<i class="fas fa-microphone"></i>`;
        audioAllowed = 1;
        audioButt.style.backgroundColor = "#4ECCA3";

        if (mystream){
            mystream.getTracks().forEach((track) => {
                if (track.kind === "audio"){
                    track.enabled = true;
                }
            })
        }

        mymuteicon.style.visibility = "hidden";
        socket.emit("action", "unmute")

    }
})

cutCall.addEventListener('click', () => {
    location.href = '/';
})
