import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system";
import io from "socket.io-client";
import AntDesign from "@expo/vector-icons/AntDesign";
import axios from "axios";
// const socket = io("http://127.0.0.1:3001");
const socket = io("http://192.168.1.18:3001", {
  transports: ["websocket"], // Ensure WebSocket is used
});

export default function Index() {
  const [recording, setRecording] = useState(null);
  const [base64Audio, setBase64Audio] = useState("");
  const [sound, setSound] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  useEffect(() => {
    // Log socket connection
    const handleConnect = () => {
      console.log("Connected to the server!");
      console.log("Socket ID:", socket.id); // Print the socket ID
    };
    socket.on("connect", handleConnect);

    // Handle mic_on and mic_off events
    socket.on("mic_on", async () => {
      console.log("mic_on received from backend");
      if (!recording) {
        await startRecording();
      }
    });

    socket.on("mic_off", async () => {
      console.log("mic_off received from backend");

      await stopRecording();
    });

    // Cleanup listeners on component unmount
    return () => {
      socket.off("connect", handleConnect);
      socket.off("mic_on");
      socket.off("mic_off");
      if (sound) {
        sound.unloadAsync(); // Cleanup sound resource
      }
    };
  }, [recording, sound]); // Add 'recording' as a dependency to ensure it reacts to changes

  const startRecording = async () => {
    try {
      console.log("Requesting permissions...");
      const permission = await Audio.requestPermissionsAsync();

      if (permission.status !== "granted") {
        alert("Permission to access microphone is required!");
        return;
      }

      console.log("Starting recording...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      console.log("Recording started");
      setRecording(recording);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return; // Do nothing if there's no active recording
    }

    try {
      console.log("Stopping recording...", recording);

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      console.log("Recording saved at:", uri);

      // Convert the audio file to Base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setBase64Audio(base64);
      setRecording(null);
      setAudioUri(uri);
      await sendAudio(base64);
      console.log("Base64 Audio:", base64.substring(0, 100));
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  // const playAudio = async () => {
  //   if (!audioUri) {
  //     console.log("No audio to play");
  //     return;
  //   }

  //   try {
  //     if (sound) {
  //       await sound.unloadAsync(); // Unload previous sound if any
  //     }

  //     const { sound: newSound } = await Audio.Sound.createAsync({
  //       uri: audioUri,
  //     });
  //     setSound(newSound);

  //     console.log("Playing audio...");
  //     await newSound.playAsync();
  //   } catch (err) {
  //     console.error("Failed to play audio", err);
  //   }
  // };

  const playAudio = async () => {
    if (!audioUri) {
      console.log("No audio to play");
      return;
    }

    try {
      if (sound) {
        const status = await sound.getStatusAsync(); // Check the playback status
        if (status.isPlaying) {
          console.log("Pausing audio...");
          await sound.pauseAsync(); // Pause if already playing
        } else {
          console.log("Resuming audio...");
          await sound.playAsync(); // Resume if paused
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync({
          uri: audioUri,
        });
        setSound(newSound);

        console.log("Playing audio...");
        await newSound.playAsync();
      }
    } catch (err) {
      console.error("Failed to toggle audio", err);
    }
  };

  const sendAudio = async (base64) => {
    try {
      // Await the POST request
      const response = await axios.post(
        "http://192.168.1.3:5000/get_base64_audio",
        { audio: base64 }, // Send base64 audio data
        { headers: { "Content-Type": "application/json" } } // Include headers
      );

      // Log success
      console.log(`Audio sent successfully:`, response.data);
    } catch (err) {
      // Log the error with details
      console.error(`Failed to send audio: ${err.message}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Centered Icon */}

      <TouchableOpacity
        style={[styles.button, recording ? styles.recording : styles.start]}
        onPress={recording ? stopRecording : startRecording}
      >
        {recording ? (
          <Feather name="mic" size={40} color="white" />
        ) : (
          <Feather name="mic-off" size={40} color="white" />
        )}
      </TouchableOpacity>
      <Text style={styles.text}>{recording ? "Listening..." : "Mic off"}</Text>
      {base64Audio ? (
        <View style={styles.output}>
          <Text style={styles.base64Title}>Base64 Audio:</Text>

          <AntDesign
            onPress={playAudio}
            style={styles.play}
            name="play"
            size={20}
            color="black"
          />
          <Text style={styles.base64Text}>
            {base64Audio.substring(0, 100)}...
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Take up the full screen
    justifyContent: "center", // Vertically center content
    alignItems: "center", // Horizontally center content
    backgroundColor: "#000", // Light background
    padding: 10,
  },
  play: {
    // fontSize: 14,
    // color: "#fff",
    position: "absolute",
    left: "98%",
    top: 10,
  },
  text: {
    fontSize: 18,
    color: "#fff",
    marginBottom: 10,
    marginTop: 10,
  },
  button: {
    backgroundColor: "blue",
    padding: 20,
    borderRadius: 50, // Round button
    justifyContent: "center", // Vertically center content inside the button
    alignItems: "center", // Horizontally center content inside the button
  },
  recording: {
    backgroundColor: "green",
  },
  start: {
    backgroundColor: "red",
  },
  output: {
    position: "absolute",
    marginTop: 20,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 5,
    bottom: 30,
  },
  base64Title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  base64Text: {
    fontSize: 14,
    marginTop: 5,
    color: "#555",
  },
});
