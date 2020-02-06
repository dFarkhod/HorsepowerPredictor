/**
 * Mashinalar haqidagi ma'lumot saqlanuvchi json faylini bulutdan yuklab olamiz
 * va u to'plamdan faqatgina bizga kerak bo'lgan joylarini ya'ni, Miles_per_Gallon va Horsepower xossalarini olib
 * "miles per gallon"ni "kilometers per liter"ga o'giramiz
 * undan keyin bunday ma'lumoti yo'q bo'lgan yozuvlarni natijaviy to'plamdan o'chirib tashlaymiz
 */
async function getData() {
    const carsDataRequest = await fetch('https://storage.googleapis.com/tfjs-tutorials/carsData.json');  
    const carsData = await carsDataRequest.json();  
    const cleanData = carsData.map(car => ({
      kmpl: car.Miles_per_Gallon / 2.352,
      horsepower: car.Horsepower,
    }))
    .filter(car => (car.kmpl != null && car.horsepower != null));
    
    return cleanData;
  }

  async function run() {
    // Bo'lajak modelimizni qurishda ishlatiladigan ma'lumotni yuklab olib, uni tayyorlab qo'yamiz.
    const data = await getData();
    const values = data.map(d => ({
      x: d.horsepower,
      y: d.kmpl,
    }));
  
    tfvis.render.scatterplot(
      {name: 'Horsepower v Km per Liter'},
      {values}, 
      {
        xLabel: 'Horsepower',
        yLabel: 'Km per Liter',
        height: 300
      }
    );
  
    // Modelni yaratib olamiz:
    const model = createModel();  
    tfvis.show.modelSummary({name: 'Model Summary'}, model);   
    
    // Ma'lumotni tensorga o'giramiz:
    const tensorData = convertToTensor(data);
    const {inputs, labels} = tensorData;
        
    // Modelimizni "train" qilamiz, ya'ni o'rgatamiz:
    await trainModel(model, inputs, labels);
    console.log('Done Training');

    // Make some predictions using the model and compare them to the
    // original data
    testModel(model, data, tensorData);
  }
  
  document.addEventListener('DOMContentLoaded', run);

  function createModel() {
    // Sequential (ketma-ket) modelni qurib olamiz:
    const model = tf.sequential(); 
    
    // Modelimizga bitta hidden layer (yashirin qatlam) qo'shamiz:
    model.add(tf.layers.dense({inputShape: [1], units: 1, useBias: true}));

    // model.add(tf.layers.dense({units: 50, activation: 'sigmoid'}));
    
    // Modelimizga bitta output layer (chiqish qatlami) qo'shamiz:
    model.add(tf.layers.dense({units: 1, useBias: true}));
  
    return model;
  }

 /*
 * Berilgan ma'lumotni "machine learning" maqsadida ishlata olishlik uchun, uni tensorlarga o'giramiz
 * Bundan tashqari biz yana y-o'qidagi KmPerLiter ma'lumoti ustida 
 * shuffling (aralashtirish) va normalization (tartibga solish) amallarini bajaramiz
 */
function convertToTensor(data) {
    // Hisob-kitobimiz uchun ishlatiladigan tensorlarni xotiradan tozalab tashlashlik maqsadida
    // barcha ishlarimizni tidy ichida bajarishimiz kerak:
    return tf.tidy(() => {
      // 1-qadam. Ma'lumotni aralashtiramiz: 
      tf.util.shuffle(data);
  
      // 2-qadam. Ma'lumotni tensorlarga o'giramiz:
      const inputs = data.map(d => d.horsepower)
      const labels = data.map(d => d.kmpl);
  
      const inputTensor = tf.tensor2d(inputs, [inputs.length, 1]);
      const labelTensor = tf.tensor2d(labels, [labels.length, 1]);
  
      // 3-qadam. Ma'lumotni 0 - 1 oralig'i tushurib, uni tartibga solamiz. 
      // Bunda min-max scaling (o'lchovi) dan foydalanamiz:
      const inputMax = inputTensor.max();
      const inputMin = inputTensor.min();  
      const labelMax = labelTensor.max();
      const labelMin = labelTensor.min();
  
      const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
      const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));
  
      return {
        inputs: normalizedInputs,
        labels: normalizedLabels,
        // Keyinroq ishlata olishlik maqsadida min/max chegaralarini qaytarib beramiz:
        inputMax,
        inputMin,
        labelMax,
        labelMin,
      }
    });  
  }

  async function trainModel(model, inputs, labels) {
    // Modelimizni training uchun tayyorlab olamiz
    model.compile({
      optimizer: tf.train.adam(),
      loss: tf.losses.meanSquaredError,
      metrics: ['mse'],
    });
    
    const batchSize = 32;
    const epochs = 50;
    
    return await model.fit(inputs, labels, {
      batchSize,
      epochs,
      shuffle: true,
      callbacks: tfvis.show.fitCallbacks(
        { name: 'Training Performance' },
        ['loss', 'mse'], 
        { height: 200, callbacks: ['onEpochEnd'] }
      )
    });
  }


  function testModel(model, inputData, normalizationData) {
    const {inputMax, inputMin, labelMin, labelMax} = normalizationData;  
    
    // Generate predictions for a uniform range of numbers between 0 and 1;
    // We un-normalize the data by doing the inverse of the min-max scaling 
    // that we did earlier.
    const [xs, preds] = tf.tidy(() => {
      
       const xs = tf.linspace(0, 1, 100);      
       const preds = model.predict(xs.reshape([100, 1]));      
      //  const predTensor = tf.tensor2d([50, 52], [2, 1]);
        const preds = model.predict(predTensor.reshape([2, 1]));    

      const unNormXs = xs
        .mul(inputMax.sub(inputMin))
        .add(inputMin);
      
      const unNormPreds = preds
        .mul(labelMax.sub(labelMin))
        .add(labelMin);
      
      // Un-normalize the data
      return [unNormXs.dataSync(), unNormPreds.dataSync()];
    });
    
   
    const predictedPoints = Array.from(xs).map((val, i) => {
      return {x: val, y: preds[i]}
    });
    
    const originalPoints = inputData.map(d => ({
      x: d.horsepower, y: d.kmpl,
    }));
    
    
    tfvis.render.scatterplot(
      {name: 'Model Predictions vs Original Data'}, 
      {values: [originalPoints, predictedPoints], series: ['original', 'predicted']}, 
      {
        xLabel: 'Horsepower',
        yLabel: 'Km per Liter',
        height: 300
      }
    );
  }