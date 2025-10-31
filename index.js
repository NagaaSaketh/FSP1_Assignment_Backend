const { initialiseDB } = require("./db/db.connect");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/user.model");
const Task = require("./models/task.model");
const Team = require("./models/team.model");
const Project = require("./models/project.model");
const Tag = require("./models/tags.model");

const app = express();

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());

initialiseDB();

app.get("/", (req, res) => res.send("FSP1_Assignment"));

// Middleware for verifying JWT.

const verifyJWT = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ message: "No Token provided" });
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};

//  Function to create a new user.
async function createUser(name, email, hashedPassword) {
  try {
    const user = new User({ name, email, password: hashedPassword });
    const savedUser = await user.save();
    return savedUser;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route for signup

app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await createUser(name, email, hashedPassword);

    res.status(201).json({ message: "User created successfully", newUser });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// API route for login

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Invalid Credentials" });
    }

    const isPasswordValid = bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(404).json({ error: "Invalid Credentials" });
    }

    const token = jwt.sign(
      { name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.status(200).json({ message: "Login Success", token });
  } catch (err) {
    res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/admin/api/data", verifyJWT, (req, res) => {
  res.json({ message: "Protected route accessible" });
});

// Function to get user details by email.

async function getUserByEmail(email) {
  try {
    const userByEmail = await User.findOne({ email }).select("-password");
    return userByEmail;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to get details of authenticated user based on JWT.

app.get("/auth/me", verifyJWT, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// Function to get all the users from db

async function getAllUsers() {
  try {
    const users = await User.find();
    return users;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to retrieve all the users from db.

app.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers();
    if (users.length != 0) {
      res.status(200).json({ users });
    } else {
      res.status(404).json({ message: "No Users found." });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Function to create a new task

async function createTask(newTask) {
  try {
    const task = new Task(newTask);
    const savedTask = await task.save();
    return savedTask;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to create a new task.

app.post("/tasks", async (req, res) => {
  try {
    const task = await createTask(req.body);
    if (task) {
      res.status(201).json(task);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to create new task" });
  }
});

// Function to get all tasks (filtering)

async function getTasksByFilters(filters = {}) {
  try {
    const tasks = await Task.find(filters);
    return tasks;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to get the tasks based on filters.

app.get("/tasks", async (req, res) => {
  try {
    const { team, owner, tags, status, project } = req.query;

    let filters = {};

    if (team) {
      const teamDoc = await Team.findOne({ name: team });
      if (!teamDoc) {
        return res.status(404).json({ error: "No team found." });
      }
      filters.team = teamDoc._id;
    }

    if (owner) {
      const user = await User.findOne({ name: owner });
      if (!user) {
        return res.status(404).json({ error: "No owner found" });
      }
      filters.owner = user._id;
    }

    if (tags) {
      const tag = await Tag.findOne({ name: tags });
      if (!tag) {
        return res.status(404).json({ error: "No tags found" });
      }
      filters.tags = tag._id;
    }

    const validStatuses = ["To Do", "In Progress", "Completed", "Blocked"];
    if (status) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid input: 'status' must be one of ${validStatuses}.`,
        });
      }
      filters.status = status;
    }
    if (project) {
      const projectDoc = await Project.findOne({ name: project });
      if (!projectDoc) {
        return res.status(404).json({ error: "No projects found" });
      }
      filters.project = projectDoc._id;
    }

    const tasks = await getTasksByFilters(filters);
    if (tasks.length != 0) {
      res.status(200).json(tasks);
    } else {
      res.status(404).json({ error: "No tasks found." });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Function to update a task

async function updateTask(id, dataToUpdate) {
  try {
    const updatedTask = await Task.findByIdAndUpdate(id, dataToUpdate, {
      new: true,
    });
    return updatedTask;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to update a task

app.put("/tasks/:id", async (req, res) => {
  try {
    const updatedTask = await updateTask(req.params.id, req.body);
    if (updatedTask) {
      res
        .status(200)
        .json({ message: "Task updated successfully", updatedTask });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Function to delete a task

async function deleteTask(id) {
  try {
    const deletedTask = await Task.findByIdAndDelete(id);
    return deletedTask;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to delete a task by its id.

app.delete("/tasks/:id", async (req, res) => {
  try {
    const deletedTask = await deleteTask(req.params.id);
    if (deleteTask) {
      res
        .status(200)
        .json({ message: "Task deleted successfully", deletedTask });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Function to create a new team

async function createTeam(newTeam) {
  try {
    const team = new Team(newTeam);
    const savedTeam = await team.save();
    return savedTeam;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to create a new team.

app.post("/teams", async (req, res) => {
  try {
    const team = await createTeam(req.body);
    if (team) {
      res.status(201).json({ message: "Team created successfully", team });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to create new team" });
  }
});

// Function to get all teams
async function getAllTeams() {
  try {
    const teams = await Team.find();
    return teams;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to retrive all the teams from db.

app.get("/teams", async (req, res) => {
  try {
    const teams = await getAllTeams();
    if (teams.length != 0) {
      res.status(200).json({ teams });
    } else {
      res.status(404).json({ message: "No teams found." });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch teams" });
  }
});

// Function to create a new project

async function createProject(newProject) {
  try {
    const project = new Project(newProject);
    const savedProject = await project.save();
    return savedProject;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to create a new project

app.post("/projects", async (req, res) => {
  try {
    const projects = await createProject(req.body);
    if (projects) {
      res
        .status(201)
        .json({ message: "Project created successfully", projects });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to create new project" });
  }
});

// Function to get all the projects

async function getAllProjects() {
  try {
    const projects = await Project.find();
    return projects;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to retrieve all the projects from db

app.get("/projects", async (req, res) => {
  try {
    const projects = await getAllProjects();
    if (projects.length != 0) {
      res.status(200).json({ projects });
    } else {
      res.status(404).json({ message: "No projects found." });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// Function to create new tags

async function createTags(tags) {
  try {
    const newTags = new Tag(tags);
    const savedTags = await newTags.save();
    return savedTags;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to create tags

app.post("/tags", async (req, res) => {
  try {
    const tags = await createTags(req.body);
    if (tags) {
      res.status(201).json({ tags });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to create tags" });
  }
});

// Function to get all the tags

async function getAllTags() {
  try {
    const tags = await Tag.find();
    return tags;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to retrieve all the tags from the db

app.get("/tags", async (req, res) => {
  try {
    const tags = await getAllTags();
    if (tags.length != 0) {
      res.status(200).json({ tags });
    } else {
      res.status(404).json({ message: "No tags found." });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tags" });
  }
});

// Function to fetch tasks completed last week.

async function getReportByLastWeek() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tasks = await Task.find({
      status: "Completed",
      updatedAt: { $gte: sevenDaysAgo },
    });
    return tasks;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to fetch tasks closed last week

app.get("/report/last-week", async (req, res) => {
  try {
    const report = await getReportByLastWeek();
    if (report.length != 0) {
      res.status(200).json({ report });
    } else {
      res.status(404).json({ message: "No tasks found." });
    }
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch tasks that were closed lastweek." });
  }
});

// Fucntion to fetch total days of work pending for all tasks.

async function getTotalPendingDays() {
  try {
    const pendingTasks = await Task.find({ status: { $ne: "Completed" } });

    const totalDays = pendingTasks.reduce((acc, curr) => {
      return acc + (curr.timeToComplete || 0);
    }, 0);

    return { totalDays, taskCount: pendingTasks.length };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route to fetch total pending work days

app.get("/report/pending", async (req, res) => {
  try {
    const report = await getTotalPendingDays();
    if (report) {
      res.status(200).json({ report });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to calculate total pending work days" });
  }
});

// Function to get closed tasks grouped by team , owner or project

async function getClosedTasksByGroup(groupBy) {
  try {
    const validGroups = ["team", "owner", "project"];
    if (!validGroups.includes(groupBy)) {
      throw new Error("Invalid group , Must be team , owner or project");
    }
    const results = await Task.aggregate([
      {
        $match: { status: "Completed" },
      },
      {
        $group: {
          _id: `$${groupBy}`,
          count: { $sum: 1 },
          tasks: { $push: "$$ROOT" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return results;
  } catch (err) {
    console.log(err);
    throw err;
  }
}
// API route to fetch closed tasks by team,owner or project
app.get("/report/closed-tasks", async (req, res) => {
  try {
    const groupBy = req.query.groupBy || "team";

    const results = await getClosedTasksByGroup(groupBy);

    if (results && results.length > 0) {
      res.status(200).json({
        groupedBy: groupBy,
        results: results.map((item) => ({
          [groupBy]: item._id,
          completedTaskCount: item.count,
          tasks: item.tasks,
        })),
        totalCompleted: results.reduce((sum, item) => sum + item.count, 0),
      });
    } else {
      res.status(200).json({
        groupedBy: groupBy,
        results: [],
        totalCompleted: 0,
        message: "No completed tasks found.",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch closed tasks report." });
  }
});
app.listen(4000, () => console.log("Server is running on 4000"));
