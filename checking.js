const MLR = require('ml-regression-multivariate-linear');

const weights = [0.5, 0.2, 0.15, 0.15];
const predictions = [];

const courses = [
  {
    mid_term_obtained: 10,
    assignments_obtained: 20,
    quiz_obtained: 5,
    projects_obtained: 5
  },
  {
    mid_term_obtained: 8,
    assignments_obtained: 17,
    quiz_obtained: 4,
    projects_obtained: 3
  }
];

courses.forEach((course) => {
  const totalMarks =
    course.mid_term_obtained +
    course.assignments_obtained +
    course.quiz_obtained +
    course.projects_obtained;

  // Normalize each component based on total marks (assuming totalMarks is not 0)
  const normalizedMid = (course.mid_term_obtained / totalMarks) * 50;
  const normalizedAssignment = (course.assignments_obtained / totalMarks) * 50;
  const normalizedQuiz = (course.quiz_obtained / totalMarks) * 50;
  const normalizedProject = (course.projects_obtained / totalMarks) * 50;

  const courseData = [normalizedMid, normalizedAssignment, normalizedQuiz, normalizedProject];

  // Sample data for linear regression
  const trainingData = [
    [30, 5, 10, 5, 50], // [mid, assignment, quiz, project, final]
    // Add more training data as needed
  ];

  const inputs = trainingData.map((entry) => entry.slice(0, -1));
  const outputs = trainingData.map((entry) => [entry[entry.length - 1]]);

  // Train the multi-variable linear regression model
  const mlr = new MLR(inputs, outputs, { weights });

  const predictedFinalMarks = mlr.predict([courseData]);

  // Accessing the predicted value
  const predictedValue = predictedFinalMarks[0][0];

  console.log(predictedValue);

  predictions.push({
    courseId: course.course_id, // Assuming you have course_id in your data
    courseName: course.course_name, // Assuming you have course_name in your data
    predictedMarks: Math.min(predictedValue, 50),
  });

  console.log(predictions);
});
