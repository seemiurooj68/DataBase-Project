const express = require("express");
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
// const { LinearRegression } = require('ml-regression');
const MLR = require('ml-regression-multivariate-linear');

const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
    optionSuccessStatus: 200
};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(cors(corsOptions));

const db = new Pool({
    host: "localhost",
    user: "postgres",  // default postgres user
    password: "seemi",
    database: "studentanalysis1",
    port: 5432  // default postgres port
});

app.post('/signup', async (req, res) => {
    const sql = "INSERT INTO login (std_name, std_id, password) VALUES ($1, $2, $3) RETURNING *"; 
    const values = [req.body.std_name, req.body.std_id, req.body.password];

    try {
        const result = await db.query(sql, values);
        res.json(result);
    } catch (err) {
        res.json("Error");
    }
});

app.post('/login', async (req, res) => {
    const sql = "SELECT * FROM login WHERE std_id = $1 AND password = $2"; 

    try {
        const result = await db.query(sql, [req.body.std_id, req.body.password]);
        if (result.rows.length > 0) {
            res.json("Success");
        } else {
            res.json("Fail");
        }
    } catch (err) {
        res.json("Error");
    }
});

//LOGIN DELETE AND ROLLBACK


// Delete login endpoint
app.post('/delete_login', async (req, res) => {
    const deleteSql = 'DELETE FROM login WHERE std_id = $1 AND password = $2';
    const logSql = 'INSERT INTO log_table (std_name, std_id, password) VALUES ($1, $2, $3)';
  
    try {
      // Start a transaction
      await db.query('BEGIN');
  
      // Delete from login table
      await db.query(deleteSql, [req.body.std_id, req.body.password]);
  
      // Insert into log_table for rollback
      await db.query(logSql, [
        req.body.std_name,
        req.body.std_id,
        req.body.password,
      ]);
  
      // Commit the transaction
      await db.query('COMMIT');
  
      res.json('Success');
    } catch (err) {
      // Rollback in case of an error
      await db.query('ROLLBACK');
      res.json('Error');
    }
  });


// Rollback endpoint
app.post('/rollback', async (req, res) => {
    const rollbackSql = `
      DELETE FROM log_table 
      RETURNING std_name, std_id, password
    `;
  
    try {
      // Start a transaction and create a savepoint
      await db.query('BEGIN');
      await db.query('SAVEPOINT rollback_savepoint');
  
      // Fetch the recently deleted data from log_table
      const result = await db.query(rollbackSql);
  
      if (result.rows.length > 0) {
        // Insert the data back into the login table
        const insertSql = `
          INSERT INTO login (std_name, std_id, password)
          VALUES ($1, $2, $3)
        `;
        await db.query(insertSql, [
          result.rows[0].std_name,
          result.rows[0].std_id,
          result.rows[0].password,
        ]);
  
        // Commit the transaction
        await db.query('COMMIT');
        res.json('Success');
      } else {
        // Rollback to the savepoint if no data found in log_table
        await db.query('ROLLBACK TO SAVEPOINT rollback_savepoint');
        res.json('No data for rollback');
      }
    } catch (err) {
      // Rollback the entire transaction in case of an error
      await db.query('ROLLBACK');
      console.error('Rollback Error:', err);
      res.json('Error');
    }
  });
  


app.get('/getUserDetailsByID/:ID', async (req, res) => {
    const std_id = req.params.ID;
    try {
        const result = await db.query("SELECT * FROM students WHERE std_id = $1", [std_id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});


app.post('/addStudent', async (req, res) => {

    const { std_id, student } = req.body;

    const studentData = [
        std_id, student.std_name, student.std_dob, student.std_email,
        student.std_phone_no, student.gender, student.degree, student.batch, student.semester
    ];

    const insertSql = "INSERT INTO students (std_id, std_name, std_dob, std_email, std_phone_no, gender, degree, batch, semester) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *";

    try {
        const result = await db.query(insertSql, studentData);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message || err);  // Log the error message
        console.error(err);  // Log the error for more details
        res.json("Error");
    }
    
});


//update student detail

app.put('/updateStudent/:id', async (req, res) => {
    const studentId = req.params.id;
    const updatedStudent = req.body;

    const updateSql = `
        UPDATE students
        SET std_name = $1, std_dob = $2, std_email = $3, std_phone_no = $4, gender = $5, degree = $6, batch = $7, semester = $8
        WHERE std_id = $9
        RETURNING *`;

    const updateValues = [
        updatedStudent.std_name,
        updatedStudent.std_dob,
        updatedStudent.std_email,
        updatedStudent.std_phone_no,
        updatedStudent.gender,
        updatedStudent.degree,
        updatedStudent.batch,
        updatedStudent.semester,
        studentId
    ];

    try {
        const result = await db.query(updateSql, updateValues);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message || err);
        res.status(500).json("Error updating student");
    }
});

//Delete student detail
app.delete('/deleteStudent/:id', async (req, res) => {
    const studentId = req.params.id;

    const deleteSql = `
        DELETE FROM students
        WHERE std_id = $1
        RETURNING *`;

    try {
        const result = await db.query(deleteSql, [studentId]);
        res.json({ message: 'Student deleted successfully', deletedStudent: result.rows[0] });
    } catch (err) {
        console.error(err.message || err);
        res.status(500).json("Error deleting student");
    }
});
//student ROLLBACK
app.post('/rollback1', async (req, res) => {
    const { std_id, student } = req.body;
  try {
        // Start a transaction
        await db.query('BEGIN');

        // Create a savepoint
        //await db.query('SAVEPOINT savepoint_rollback');

        await db.query('INSERT INTO students VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [std_id, student.std_name, student.std_dob, student.std_email, student.std_phone_no, student.gender, student.degree, student.batch, student.semester]);

        await db.query('DELETE FROM student_log WHERE std_id = $1 RETURNING *', [std_id]);

        await db.query('COMMIT');
        res.status(200).json({ message: 'Rollback successful' });
    } catch (error) {
        // If there's an error, rollback to the savepoint
        //await db.query('ROLLBACK TO savepoint_rollback');
        console.error('Error during rollback:', error);
        res.status(500).json({ error: 'Rollback failed' });
     } //finally {
    //     // Release the savepoint
    //     await db.query('RELEASE savepoint_rollback');
    // }
});

app.get('/getUserDetailsByIDlogtable/:ID', async (req, res) => {
    const std_id = req.params.ID;
    try {
        const result = await db.query("SELECT * FROM student_log WHERE std_id = $1", [std_id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});


app.post('/updateStudentInfo', async (req, res) => {
    const { std_id, updateOption, updatedValue } = req.body;

    try {
        // Construct the kSQL query based on the updateOption
        let query = '';
        let queryParams = [updatedValue, std_id];

        switch (updateOption) {
            case 'std_email':
                query = 'UPDATE students SET std_email = $1 WHERE std_id = $2';
                break;
            case 'std_phone_no':
                query = 'UPDATE students SET std_phone_no = $1 WHERE std_id = $2';
                break;
            case 'semester':
                query = 'UPDATE students SET semester = $1 WHERE std_id = $2';
                break;
            default:
                return res.status(400).send('Invalid update option');
        }

        // Execute the update query
        await db.query(query, queryParams);
        res.status(200).send('Student information updated successfully');
    } catch (error) {
        console.error('Error updating student information:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/studentExists/:std_id', async (req, res) => {
    const stdId = parseInt(req.params.std_id, 10);

    try {
        const result = await db.query("SELECT * FROM students WHERE std_id = $1", [stdId]);
        if (result.rows.length > 0) {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

app.get('/studentDetails/:std_email', async (req, res) => {
    const email = req.params.std_email;
    try {
        const result = await db.query("SELECT * FROM students WHERE std_email = $1", [email]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});



app.get('/courses/:semester', async (req, res) => {
    const semester = req.params.semester;

    try {
        const result = await db.query("SELECT * FROM courses WHERE semester = $1", [semester]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

app.get('/semesters', async (req, res) => {
    try {
        const result = await db.query("SELECT DISTINCT semester FROM courses ORDER BY semester");
        const semesters = result.rows.map(row => row.semester);
        res.json(semesters);
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

// Function to calculate GPA
function calculateCourseGPA(totalMarks, totalMaxMarks) {
    const percentage = (totalMarks / totalMaxMarks) * 100;

    if (percentage >= 86) {
        return 4.0; // A
    } else if (percentage >=82 && percentage <86 ) {
        return 3.67; // A-
    } else if (percentage >= 78 && percentage <82) {
        return 3.33; // B+
    } else if (percentage >= 74  && percentage <78) {
        return 3; // B-
    } else if (percentage >= 70  && percentage <74) {
        return 2.67; // C+
    } else if (percentage >= 66  && percentage <70) {
        return 2.33; // C-
    } else if (percentage >= 62  && percentage <66) {
        return 2; // D+
    }  else if (percentage >= 58  && percentage <62) {
        return 1.67; // D-
    } else if (percentage >= 54  && percentage <58) {
        return 1.33; // 
    }  else if (percentage >= 50  && percentage <54) {
        return 1; // D
    } 
    else {
        return 0.0; // F
    }
}

// Function to calculate Grade
function calculateGrade(totalMarks, totalMaxMarks) {
    const percentage = (totalMarks / totalMaxMarks) * 100;

    if (percentage >= 90) {
        return 'A+';
    } else if (percentage >= 86 && percentage<90 ) {
        return 'A';
    } else if (percentage >= 82 && percentage<86) {
        return 'A-';
    } else if (percentage >= 78 && percentage<82) {
        return 'B+';
    } else if (percentage >= 74 && percentage<78) {
        return 'B';
    } else if (percentage >= 70 && percentage<74) {
        return 'B-';
    } else if (percentage >= 66 && percentage<70) {
        return 'C+';
    }else if (percentage >= 62 && percentage<66) {
        return 'C';
    }else if (percentage >= 58 && percentage<62) {
        return 'C-';
    }else if (percentage >= 54 && percentage<58) {
        return 'D+';
    }else if (percentage >= 50 && percentage<54) {
        return 'D';
    }
     else {
        return 'F';
    }
}

// ... existing routes ...

// Add these functions at the end of your server.js file

app.get('/fetchStudentId/:email', async (req, res) => {
    const { email } = req.params;
    
    const sql = `SELECT std_id FROM students WHERE std_email = $1`;

    try {
        const result = await db.query(sql, [email]);
        if (result.rows.length > 0) {
            res.json({ std_id: result.rows[0].std_id });
        } else {
            res.status(404).json({ error: 'Student not found' });
        }
    } catch (err) {
        console.error(err.message || err);
        res.status(500).json("Server error");
    }
});


app.get('/getSemesterByID/:ID', async (req, res) => {
    const std_id = req.params.ID;
    try {
        const result = await db.query("SELECT semester FROM students WHERE std_id = $1", [std_id]);
        if (result.rows.length > 0) {
                        res.json({ semester: result.rows[0].semester });
                    } else {
                        res.status(404).json({ error: 'Student not found' });
                    }
                } catch (err) {
                    console.error(err.message || err);
                    res.status(500).json("Server error");
                }
});

app.post('/submitMarks', async (req, res) => {
    const { std_id, course_id, marks,semester } = req.body;

    try {
        const total_obtained =
            marks.mid_term_obtained +
            marks.quiz_obtained +
            marks.assignments_obtained +
            marks.projects_obtained +
            //marks.final_exam_obtained +
            marks.class_participation_obtained;

        const insertSql = `
            INSERT INTO marks (
                std_id,
                course_id,
                mid_term_obtained,
                mid_term_total,
                quiz_obtained,
                quiz_total,
                assignments_obtained,
                assignments_total,
                projects_obtained,
                projects_total,
                class_participation_obtained,
                class_participation_total,
                semester
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`;

        const values = [
            std_id,
            course_id, // Use the provided course_id
            marks.mid_term_obtained,
            marks.mid_term_total,
            marks.quiz_obtained,
            marks.quiz_total,
            marks.assignments_obtained,
            marks.assignments_total,
            marks.projects_obtained,
            marks.projects_total,
            //marks.final_exam_obtained,
            //marks.final_exam_total,
            marks.class_participation_obtained,
            marks.class_participation_total,
            semester
            //total_obtained,
            //calculateCourseGPA(total_obtained, grades.mid_term_total + grades.quiz_total + grades.assignments_total + grades.projects_total + grades.final_exam_total + grades.class_participation_total),
            //calculateGrade(total_obtained, grades.mid_term_total + grades.quiz_total + grades.assignments_total + grades.projects_total + grades.final_exam_total + grades.class_participation_total)
        ];

        const result = await db.query(insertSql, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message || err);
        res.json("Error");
    }
});



app.post('/submitGrades', async (req, res) => {
    const { std_id, course_id, grades, semester } = req.body;

    try {
        const insertSql = `
            INSERT INTO grades (
                std_id,
                course_id,
                course_gpa,
                course_grade,
                semester
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;

        const values = [
            std_id,
            course_id,
            grades.course_gpa,
            grades.course_grade,
            semester
        ];

        const result = await db.query(insertSql, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message || err);
        res.json("Error");
    }
});


//transcript
// Fetch transcript data for a specific student
app.get('/transcript/:studentId', async (req, res) => {
    const studentId = req.params.studentId;

    try {
        // Fetch SGPA and other details from the transcript table
        const transcriptQuery = `
            SELECT semester, sgpa
            FROM transcript
            WHERE std_id = $1
            ORDER BY semester`;
        
        const transcriptResult = await db.query(transcriptQuery, [studentId]);
        const transcriptData = transcriptResult.rows;

        // Fetch semester-wise course details from the grades table
        const gradesQuery = `
            SELECT semester, course_id, course_gpa
            FROM grades
            WHERE std_id = $1
            ORDER BY semester`;

        const gradesResult = await db.query(gradesQuery, [studentId]);
        const gradesData = gradesResult.rows;

        res.json({ transcript: transcriptData, grades: gradesData });
    } catch (err) {
        console.error(err.message || err);
        res.status(500).json("Error");
    }
});


app.post('/updateCourseGPA/:studentId/:courseId/:semester', async (req, res) => {
    const { studentId, courseId, semester } = req.params;
    const { newGPA } = req.body;
  
    try {
      // Check if the course GPA record exists
      const checkGPAQuery = 'SELECT * FROM grades WHERE student_id = $1 AND course_id = $2 AND semester = $3';
      const checkGPAResult = await db.query(checkGPAQuery, [studentId, courseId, semester]);
  
      if (checkGPAResult.rows.length === 0) {
        res.status(404).send('Course GPA record not found');
        return;
      }
  
      // Update the course GPA
      const updateGPAQuery = 'UPDATE grades SET course_gpa = $1 WHERE student_id = $2 AND course_id = $3 AND semester = $4';
      await db.query(updateGPAQuery, [newGPA, studentId, courseId, semester]);
  
      res.status(200).send('Course GPA updated successfully');
    } catch (error) {
      console.error('Error updating course GPA:', error);
      res.status(500).send('Internal Server Error');
    }
  });

app.post('/submitBehaviour', async (req, res) => {
    const { std_id, study_hours, way_of_study, class_participation, extracurricular } = req.body;

    try {
        const insertSql = `
            INSERT INTO behaviour (
                std_id,
                study_hours,
                way_of_study,
                class_participation,
                extracurricular
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;

        const values = [
            std_id,
            study_hours,
            way_of_study,
            class_participation,
            extracurricular
        ];

        const result = await db.query(insertSql, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message || err);
        res.json("Error");
    }
});

app.get('/fetchcourses/:student_id', async (req, res) => {
    const student_id = req.params.student_id;

    try {
        const result = await db.query("SELECT * FROM courses c join marks m on c.course_id=m.course_id WHERE std_id = $1", [student_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

  app.get('/getMarks/:studentId/:courseId', async (req, res) => {
    const studentId = req.params.studentId;
    const courseId = req.params.courseId;
  
    try {
      const result = await db.query("SELECT * FROM marks WHERE std_id = $1 AND course_id = $2",[studentId, courseId]);
  
      if (result.rows.length > 0) {
        const studentMarks = result.rows[0];
        res.json(studentMarks);
      } else {
        res.status(404).json({ error: 'Marks not found' });
      }
    } catch (error) {
      console.error('Error fetching marks:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });



  //DELETE MARKS 
  app.delete('/deleteCoursemarks/:studentId/:courseId', async (req, res) => {
    const { studentId, courseId } = req.params;

    try {
      const result = await db.query('DELETE FROM marks WHERE std_id = $1 AND course_id = $2', [
        studentId,
        courseId,
      ]);

      if (result.rowCount > 0) {
        res.json({ message: `Course ID ${courseId} deleted successfully.` });
      } else {
        res.status(404).json({ error: `Course ID ${courseId} not found.` });
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
// Add this route in your server.js or wherever you define your backend routes

app.get('/getBehaviour/:std_id', async (req, res) => {
    const std_id = req.params.std_id;

    try {
        const result = await db.query("SELECT * FROM behaviour WHERE std_id = $1", [std_id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

//ANALYSIS.JS QUERIES

app.get('/semesterAnalysis/:studentId', async (req, res) => {
    const studentId = req.params.studentId;

    try {
        const result = await db.query("SELECT * FROM grades WHERE std_id = $1", [studentId]);
        const semesters = {};

        result.rows.forEach((row) => {
            if (!semesters[row.semester]) {
                semesters[row.semester] = [];
            }

            semesters[row.semester].push({
                course_id: row.course_id,
                course_gpa: row.course_gpa,
            });
        });

        const semesterData = Object.values(semesters);
        res.json(semesterData);
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

app.get('/courseCategories', async (req, res) => {
    try {
        const result = await db.query("SELECT course_id, category FROM courses");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

app.get('/courseGPA/:studentId', async (req, res) => {
    const studentId = req.params.studentId;

    try {
        const result = await db.query("SELECT course_id, course_gpa FROM grades WHERE std_id = $1", [studentId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json("Server error");
    }
});

app.get('/nextSemesterCourses/:studentId', async (req, res) =>  {
    const { studentId } = req.params;  // Corrected line
  
    try {
      const result = await db.query(`
        WITH RankedCategories AS (
          SELECT
            c.category,
            DENSE_RANK() OVER (ORDER BY MAX(g.course_gpa) DESC) AS category_rank
          FROM
            grades g
            JOIN courses c ON g.course_id = c.course_id
          WHERE
            g.std_id = $1
          GROUP BY
            c.category
        )
        SELECT
            c.course_id,
            c.course_name,
            c.credits,
            c.course_type,
            c.semester,
            c.category
        FROM
            courses c
            JOIN RankedCategories rc ON c.category = rc.category
        WHERE
            c.semester = (SELECT MAX(semester) + 1 FROM grades WHERE semester >= 1 AND semester <= 8 AND std_id = $1)
            AND rc.category_rank <= 2
            AND c.category IN (SELECT category FROM RankedCategories WHERE category_rank = 1 OR category_rank = 2);
      `, [studentId]);
  
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching ranked courses:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/coursesfetchgrades/:studentId', async (req, res) => {
    const {studentId } = req.params;

    try {
      const result = await db.query(
        'SELECT * FROM grades g join courses c on c.course_id=g.course_id WHERE std_id = $1',
        [studentId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/deleteCourse/:studentId/:courseId', async (req, res) => {
    const { studentId, courseId } = req.params;

    try {
      const result = await db.query('DELETE FROM grades WHERE std_id = $1 AND course_id = $2', [
        studentId,
        courseId,
      ]);

      if (result.rowCount > 0) {
        res.json({ message: `Course ID ${courseId} deleted successfully.` });
      } else {
        res.status(404).json({ error: `Course ID ${courseId} not found.` });
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/updateMarks', async (req, res) => {
    const { std_id, course_id, marks } = req.body;

    try {
      // Start a transaction
      const client = await db.connect();
      await client.query('BEGIN');

      // Update marks table
      const marksQuery = `
        UPDATE marks
        SET
          mid_term_obtained = $1,
          mid_term_total = $2,
          quiz_obtained = $3,
          quiz_total = $4,
          assignments_obtained = $5,
          assignments_total = $6,
          projects_obtained = $7,
          projects_total = $8,
          class_participation_obtained = $9,
          class_participation_total = $10
        WHERE
          std_id = $11
          AND course_id = $12
      `;

      await client.query(marksQuery, [
        marks.mid_term_obtained,
        marks.mid_term_total,
        marks.quiz_obtained,
        marks.quiz_total,
        marks.assignments_obtained,
        marks.assignments_total,
        marks.projects_obtained,
        marks.projects_total,
        marks.class_participation_obtained,
        marks.class_participation_total,
        std_id,
        course_id,
      ]);

      // Commit the transaction
      await client.query('COMMIT');

      // Release the client back to the pool
      client.release();

      res.json({ success: true, message: 'Marks updated successfully' });
    } catch (error) {
      // If there's an error, rollback the transaction
      await client.query('ROLLBACK');

      console.error('Error updating marks:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/coursesfetchmarks/:studentId', async (req, res) => {
    const {studentId } = req.params;

    try {
      const result = await db.query(
        'SELECT * FROM marks m join courses c on c.course_id = m.course_id WHERE std_id = $1',
        [studentId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});



//TRANSCRIPT QUERIES 
app.get('/getTranscript/:studentId/:semester', async (req, res) => {
    const { studentId, semester } = req.params;

    try {
        console.log('Fetching transcript for:', studentId, semester);

        const transcriptQuery = `
            SELECT g.course_id, c.course_name, g.course_gpa
            FROM grades g JOIN courses c ON g.course_id = c.course_id
            WHERE g.std_id = $1 AND g.semester = $2
        `;

        console.log('Transcript Query:', transcriptQuery);

        const transcriptResult = await db.query(transcriptQuery, [studentId, semester]);
        const courses = transcriptResult.rows;

        const sgpaQuery = `
            SELECT sgpa, cgpa
            FROM transcript
            WHERE std_id = $1 AND semester = $2
        `;

        console.log('SGPA Query:', sgpaQuery);

        const sgpaResult = await db.query(sgpaQuery, [studentId, semester]);
        const { sgpa, cgpa } = sgpaResult.rows[0];

        res.json({ semester, courses, sgpa, cgpa });
    } catch (error) {
        console.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/getCurrentSemester/:studentId', async (req, res) => {
    const { studentId } = req.params;

    try {
        const currentSemesterQuery = `
        select DISTINCT MAX(semester)
        from grades
        where std_id = $1
        `;

        const currentSemesterResult = await db.query(currentSemesterQuery, [studentId]);

        // Check if there is a result and if the result has row
        if (currentSemesterResult.rows && currentSemesterResult.rows.length > 0) {
            const currentSemester = currentSemesterResult.rows[0].max
            res.json(currentSemester); // Send only the semester value, not an object
        } else {
            // Handle the case when no data is found for the student
            res.status(404).json({ error: 'No data found for the student' });
        }
    } catch (error) {
        console.error('Error fetching current semester:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//TRANSCRIPT QUERIES END 

app.listen(8081, () => {
    console.log("listening");
});