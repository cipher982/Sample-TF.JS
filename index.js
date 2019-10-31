/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

import * as data from './data';
import * as loader from './loader';
import * as ui from './ui';
import { spawn } from 'child_process';

let model;
//console.log("START");

/**
 * Predict website label classification.
 *
 * @param xTrain Training feature data, a `tf.Tensor` of shape
 *   [numTrainExamples, 4]. The second dimension include the features
 *   petal length, petalwidth, sepal length and sepal width.
 * @param yTrain One-hot training labels, a `tf.Tensor` of shape
 *   [numTrainExamples, 3].
 * @param xTest Test feature data, a `tf.Tensor` of shape [numTestExamples, 4].
 * @param yTest One-hot test labels, a `tf.Tensor` of shape
 *   [numTestExamples, 3].
 * @returns The trained `tf.Model` instance.
 */
async function trainModel(xTrain, yTrain, xTest, yTest) {
  ui.status('Training model... Please wait.');

  const params = ui.loadTrainParametersFromUI();

  // Define the topology of the model
  const model = tf.sequential();
  model.add(tf.layers.embedding(
      //{inputDim: params.vocabSize, outputDim: params.embeddingDim, inputLength: 200}));
      //{inputDim: params.vocabSize, outputDim: params.embeddingDim}));
      {inputDim: 16, outputDim: 500, inputLength: 200}));

  model.add(tf.layers.dense({units: 64, activation: 'relu'}));
  model.add(tf.layers.dense({units: 32, activation: 'relu'}));
  model.add(tf.layers.dense({units: 16, activation: 'relu'}));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({units: 20, activation: 'softmax'}));
  model.summary();

  const optimizer = tf.train.adam();
  model.compile({
    optimizer: optimizer,
    //loss: 'sparseCategoricalCrossentropy',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const trainLogs = [];
  const lossContainer = document.getElementById('lossCanvas');
  const accContainer = document.getElementById('accuracyCanvas');
  const beginMs = performance.now();
  // Call `model.fit` to train the model.
  const history = await model.fit(xTrain, yTrain, {
    epochs: 50,
    validationData: [xTest, yTest],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        // Plot the loss and accuracy values at the end of every training epoch.
        const secPerEpoch =
            (performance.now() - beginMs) / (1000 * (epoch + 1));
        ui.status(`Training model... Approximately ${
            secPerEpoch.toFixed(4)} seconds per epoch`)
        trainLogs.push(logs);
        tfvis.show.history(lossContainer, trainLogs, ['loss', 'val_loss'])
        tfvis.show.history(accContainer, trainLogs, ['acc', 'val_acc'])
        //calculateAndDrawConfusionMatrix(model, xTest, yTest);
      },
    }
  });
  const secPerEpoch = (performance.now() - beginMs) / (1000 * 50);
  ui.status(
      `Model training complete:  ${secPerEpoch.toFixed(4)} seconds per epoch`);
  return model;
}

/**
 * Run inference on manually-input data.
 *
 * @param model The instance of `tf.Model` to run the inference with.
 */
async function predictOnManualInput(model) {
  if (model == null) {
    ui.setManualInputWinnerMessage('ERROR: Please load or train model first.');
    return;
  }

  // Use a `tf.tidy` scope to make sure that WebGL memory allocated for the
  // `predict` call is released at the end.
  tf.tidy(() => {
    // Prepare input data as a 2D `tf.Tensor`.
    console.info("Beginning inference on new data. . .")
    const inputData = ui.getManualInputData();
    console.info("inputData: "+ inputData);
    //console.info("Shape: ")

    function callName(req, res) { 
      
      // Use child_process.spawn method from  
      // child_process module and assign it 
      // to variable spawn 
      var spawn = require("child_process").spawn; 
      var process = spawn('python',["./hello.py", 
                              'David', 
                              'Rose'] ); 
    
      // Takes stdout data from script which executed 
      // with arguments and send this data to res object 
      process.stdout.on('data', function(data) { 
          console.info(data); 
      } ) 
    }
    callName();
    
    

    const input = tf.tensor2d([inputData], [1, 20]);

    // Call `model.predict` to get the prediction output as probabilities for
    // the Iris flower categories.

    const predictOut = model.predict(input);
    const logits = Array.from(predictOut.dataSync());
    const winner = data.IRIS_CLASSES[predictOut.argMax(-1).dataSync()[0]];
    ui.setManualInputWinnerMessage(winner);
    ui.renderLogitsForManualInput(logits);
  });
}

/**
 * Draw confusion matrix.
 */
async function calculateAndDrawConfusionMatrix(model, xTest, yTest) {
  const [preds, labels] = tf.tidy(() => {
    const preds = model.predict(xTest).argMax(-1);
    const labels = yTest.argMax(-1);
    return [preds, labels];
  });

  tf.dispose([preds, labels]);
}

/**
 * Run inference on some test Iris flower data.
 *
 * @param model The instance of `tf.Model` to run the inference with.
 * @param xTest Test data feature, a `tf.Tensor` of shape [numTestExamples, 4].
 * @param yTest Test true labels, one-hot encoded, a `tf.Tensor` of shape
 *   [numTestExamples, 3].
 */
async function evaluateModelOnTestData(model, xTest, yTest) {
  ui.clearEvaluateTable();

  tf.tidy(() => {
    const xData = xTest.dataSync();
    const yTrue = yTest.argMax(-1).dataSync();
    const predictOut = model.predict(xTest);
    const yPred = predictOut.argMax(-1);
    ui.renderEvaluateTable(
        xData, yTrue, yPred.dataSync(), predictOut.dataSync());
    //calculateAndDrawConfusionMatrix(model, xTest, yTest);
  });

  predictOnManualInput(model);
}

const HOSTED_MODEL_JSON_URL =
      'https://raw.githubusercontent.com/cipher982/Sample-TF.JS/master/assets/model.json'
    //'https://ione-datascience-3be7-us-east-1.s3.amazonaws.com/public/tfJs_demo/model.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAXUBHAPNTUTFCCFXK/20191030/us-east-1/s3/aws4_request&X-Amz-Date=20191030T212407Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=203b35c2cd3b224b075ce2b2854f1163916d802dae9b4882c510abc813ad27d4';

/**
 * The main function of the Iris demo.
 */
async function iris() {
  const [xTrain, yTrain, xTest, yTest] = data.getIrisData(0.15);

  //const [xTrain]

  const localLoadButton = document.getElementById('load-local');
  const localSaveButton = document.getElementById('save-local');
  const localRemoveButton = document.getElementById('remove-local');

  document.getElementById('train-from-scratch')
      .addEventListener('click', async () => {
        ui.status('gogo model train scratch');
        model = await trainModel(xTrain, yTrain, xTest, yTest);
        await evaluateModelOnTestData(model, xTest, yTest);
        localSaveButton.disabled = false;
      });

  if (await loader.urlExists(HOSTED_MODEL_JSON_URL)) {
    //ui.status('Model available: ' + HOSTED_MODEL_JSON_URL);
    ui.status('Environment loaded.');
    const button = document.getElementById('load-pretrained-remote');
    button.addEventListener('click', async () => {
      ui.clearEvaluateTable();
      model = await loader.loadHostedPretrainedModel(HOSTED_MODEL_JSON_URL);
      await predictOnManualInput(model);
      localSaveButton.disabled = false;
    });
  }

  localLoadButton.addEventListener('click', async () => {
    model = await loader.loadModelLocally();
    await predictOnManualInput(model);
  });

  localSaveButton.addEventListener('click', async () => {
    await loader.saveModelLocally(model);
    await loader.updateLocalModelStatus();
  });

  localRemoveButton.addEventListener('click', async () => {
    await loader.removeModelLocally();
    await loader.updateLocalModelStatus();
  });

  await loader.updateLocalModelStatus();

  ui.status('Standing by.');
  ui.wireUpEvaluateTableCallbacks(() => predictOnManualInput(model));
}

iris();
