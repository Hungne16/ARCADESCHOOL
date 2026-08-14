// firebase-config.js
// Firebase V8 Compat for plain HTML
const firebaseConfig = {
    apiKey: "AIzaSyDROce7kuqxGItujKkSNvBoxil2dulYlBU",
    authDomain: "arcadeschool.firebaseapp.com",
    // Nếu anh chọn khu vực Singapore, databaseURL có thể là:
    // "https://arcadeschool-default-rtdb.asia-southeast1.firebasedatabase.app"
    // Nếu chọn US (mặc định) thì dùng:
    databaseURL: "https://arcadeschool-default-rtdb.firebaseio.com",
    projectId: "arcadeschool",
    storageBucket: "arcadeschool.firebasestorage.app",
    messagingSenderId: "440521029838",
    appId: "1:440521029838:web:e8994a7fc86032a729789f",
    measurementId: "G-9DWP6MXVJ7"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
