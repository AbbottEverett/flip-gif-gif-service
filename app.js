const express = require('express');
const app = express();
const BaseURL = 'http://localhost:8000/gifs';
const port = process.env.PORT || 8000;
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const GIFEncoder = require('gifencoder');
const Canvas = require('canvas');
const Image = Canvas.Image;

const stream = require('stream');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
// Create an S3 client
var s3 = new AWS.S3();

// Sets up enviroment variables for config
require('dotenv').config();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(morgan('dev'));

app.post('/', (req, res, next) => {
    // Create a bucket and upload something into it
   //var bucketName = 'node-sdk-sample-' + uuid.v4();
    let bucketName = 'flipgif-gif-directory'
    let payload = req.body;
    const encoder = new GIFEncoder(600, 600);
    let name = `${payload.name}.gif`;
    
    encoder.createReadStream().pipe(uploadFromStream(s3, {bucket: bucketName, key: name}, res, name));

    encoder.start();
    encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat 
    encoder.setDelay(84);  // frame delay in ms 
    encoder.setQuality(10); // image quality. 10 is default. 

    const canvas = new Canvas(600, 600);
    const ctx = canvas.getContext('2d');

    payload.frames.forEach(frame => {
        ctx.clearRect(0, 0, 600, 600);
        let img = new Image;
        img.src = frame.imgURL;
        ctx.drawImage(img, 0, 0, 600, 600);
        let removeTransparencyData = ctx.getImageData(0, 0, 600, 600);
        for (let i = 0; i < removeTransparencyData.data.length; i+=4) {
            if (removeTransparencyData.data[i+3] === 0) {
                removeTransparencyData.data[i] = 255;
                removeTransparencyData.data[i+1] = 255;
                removeTransparencyData.data[i+2] = 255;
                removeTransparencyData.data[i+3] = 1;
            }
        }
        ctx.putImageData(removeTransparencyData, 0, 0);
        encoder.addFrame(ctx);
    });
    
    return encoder.finish();
});

function uploadFromStream(s3, params, res, name) {
    var pass = new stream.PassThrough();
    
    var params = {ACL: 'public-read', Bucket: params.bucket, Key: params.key, ContentType: 'image/gif', Body: pass};
    s3.upload(params, function(err, data) {
      console.log(err);
      let url = `https://s3-us-west-2.amazonaws.com/flipgif-gif-directory/${name}`
      return res.status(200).json({ message: 'SUCCESS!', link: url });
    });
  
    return pass;
  }

app.use((err, req, res, next) => {
    const status = err.status || 500;
    console.log(err);
    res.status(status).json({ error: err });
});

app.use((req, res, next) => {
    res.status(404).json({ error: { message: 'Route not found!' }});
});

function listener() {
    console.log(`Listening on port ${port}...`);
}

app.listen(port, listener);