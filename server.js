const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { randomBytes, randomUUID } = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const mongoDB = process.env.MONGO_URL;
const sessionSecret = process.env.ADMIN_SESSION_SECRET || randomBytes(32).toString("hex");
const sessionCookieName = "portfolio_admin_session";
if (process.env.NODE_ENV === "production" && (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32)) {
    throw new Error("Set ADMIN_SESSION_SECRET to at least 32 characters before starting in production.");
}
const uploadDirectory = path.join(__dirname, "public", "uploads");
const assetPathPattern = /^\/uploads\/[\w-]+\.(jpg|jpeg|png|pdf)$/i;
const assetFields = {
    projects: "imageUrl",
    achievements: "imageUrl",
    blog: "coverImageUrl",
    reviews: "profileImageUrl"
};

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDirectory,
        filename: (req, file, callback) => {
            callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowedTypes = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".pdf": "application/pdf"
        };
        const extension = path.extname(file.originalname).toLowerCase();

        if (allowedTypes[extension] === file.mimetype) {
            callback(null, true);
        } else {
            callback(new Error("Choose a JPG, JPEG, PNG, or PDF file."));
        }
    }
});

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public folder
app.use(express.static("public"));

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        minlength: 3,
        maxlength: 32,
        match: /^[a-z0-9._-]+$/
    },
    passwordHash: { type: String, required: true, select: false }
}, { timestamps: true });

const Admin = mongoose.model("Admin", adminSchema);
const sessionRecordSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { versionKey: false });

const AdminSession = mongoose.model("AdminSession", sessionRecordSchema);

class MongoSessionStore extends session.Store {
    get(sessionId, callback) {
        AdminSession.findOne({ _id: sessionId, expiresAt: { $gt: new Date() } }).lean()
            .then((record) => callback(null, record?.data || null))
            .catch(callback);
    }

    set(sessionId, sessionData, callback = () => {}) {
        const expiresAt = sessionData.cookie?.expires ? new Date(sessionData.cookie.expires) :
            new Date(Date.now() + (sessionData.cookie?.maxAge || 2 * 60 * 60 * 1000));
        AdminSession.updateOne({ _id: sessionId }, { $set: { data: sessionData, expiresAt } }, { upsert: true })
            .then(() => callback())
            .catch(callback);
    }

    touch(sessionId, sessionData, callback = () => {}) {
        this.set(sessionId, sessionData, callback);
    }

    destroy(sessionId, callback = () => {}) {
        AdminSession.deleteOne({ _id: sessionId })
            .then(() => callback())
            .catch(callback);
    }
}

app.use(session({
    store: new MongoSessionStore(),
    name: sessionCookieName,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 2 * 60 * 60 * 1000
    }
}));

const loginAttempts = new Map();
const maxLoginAttempts = 5;
const loginBlockDuration = 15 * 60 * 1000;
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);

function validUsername(username) {
    return typeof username === "string" && /^[a-zA-Z0-9._-]{3,32}$/.test(username.trim());
}

function strongPassword(password) {
    return typeof password === "string" && password.length >= 12 && password.length <= 128 &&
        /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z0-9]/.test(password);
}

function recordFailedLogin(ip) {
    const now = Date.now();
    const attempt = loginAttempts.get(ip);
    if (!attempt || (attempt.blockedUntil && attempt.blockedUntil <= now)) {
        loginAttempts.set(ip, { count: 1, blockedUntil: 0 });
        return;
    }

    attempt.count += 1;
    if (attempt.count >= maxLoginAttempts) attempt.blockedUntil = now + loginBlockDuration;
}

function isLoginBlocked(ip) {
    const attempt = loginAttempts.get(ip);
    return Boolean(attempt && attempt.blockedUntil > Date.now());
}

function destroySession(req, res, next) {
    req.session.destroy((error) => {
        res.clearCookie(sessionCookieName, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/"
        });
        if (next) next(error);
    });
}

async function requireAdmin(req, res, next) {
    if (!req.session?.adminId) {
        if (req.originalUrl.startsWith("/api/")) return res.status(401).json({ message: "Please log in to manage content." });
        return res.redirect("/admin/login");
    }

    try {
        const admin = await Admin.findById(req.session.adminId);
        if (!admin) {
            return destroySession(req, res, () => {
                if (req.originalUrl.startsWith("/api/")) return res.status(401).json({ message: "Please log in to manage content." });
                res.redirect("/admin/login");
            });
        }
        req.admin = admin;
        next();
    } catch (error) {
        next(error);
    }
}

// Home page
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/home.html");
});

app.get("/admin/login", (req, res) => {
    if (req.session.adminId) return res.redirect("/admin");
    res.render("admin-login", { error: "" });
});

app.post("/admin/login", async (req, res, next) => {
    const ip = req.ip;
    if (isLoginBlocked(ip)) {
        return res.status(429).render("admin-login", { error: "Too many attempts. Try again in 15 minutes." });
    }

    const loginData = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const username = typeof loginData.username === "string" ? loginData.username.trim().toLowerCase() : "";
    const password = typeof loginData.password === "string" ? loginData.password : "";
    let admin = null;

    try {
        if (validUsername(username) && password.length > 0 && password.length <= 128) {
            admin = await Admin.findOne({ username }).select("+passwordHash");
        }
        const passwordMatches = await bcrypt.compare(password.slice(0, 128) || "invalid", admin?.passwordHash || dummyPasswordHash);
        if (!admin || !passwordMatches) {
            recordFailedLogin(ip);
            return res.status(401).render("admin-login", { error: "Username or password is incorrect." });
        }

        loginAttempts.delete(ip);
        req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.adminId = admin._id.toString();
            req.session.save((saveError) => {
                if (saveError) return next(saveError);
                res.redirect("/admin");
            });
        });
    } catch (error) {
        next(error);
    }
});

app.use("/admin", requireAdmin);

app.get("/admin", (req, res) => {
    res.render("admin", { username: req.admin.username });
});

app.post("/admin/logout", (req, res) => {
    destroySession(req, res, (error) => {
        if (error) return res.status(500).send("Could not log out. Please try again.");
        res.redirect("/admin/login");
    });
});

app.get("/admin/account", (req, res) => {
    res.json({ username: req.admin.username });
});

app.post("/admin/account/username", async (req, res) => {
    const accountData = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const username = typeof accountData.username === "string" ? accountData.username.trim().toLowerCase() : "";
    const currentPassword = typeof accountData.currentPassword === "string" ? accountData.currentPassword : "";

    if (!validUsername(username) || currentPassword.length === 0 || currentPassword.length > 128) {
        return res.status(400).json({ message: "Enter a valid username and your current password." });
    }

    try {
        const admin = await Admin.findById(req.session.adminId).select("+passwordHash");
        if (!await bcrypt.compare(currentPassword, admin.passwordHash)) {
            return res.status(400).json({ message: "Current password is incorrect." });
        }
        admin.username = username;
        await admin.save();
        res.json({ message: "Username updated.", username: admin.username });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            message: error.code === 11000 ? "That username is already in use." : error.message
        });
    }
});

app.post("/admin/account/password", async (req, res) => {
    const accountData = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const currentPassword = typeof accountData.currentPassword === "string" ? accountData.currentPassword : "";
    const newPassword = typeof accountData.newPassword === "string" ? accountData.newPassword : "";
    const confirmPassword = typeof accountData.confirmPassword === "string" ? accountData.confirmPassword : "";

    if (currentPassword.length === 0 || currentPassword.length > 128 || !strongPassword(newPassword)) {
        return res.status(400).json({ message: "Use a password with 12-128 characters, including uppercase, lowercase, a number, and a symbol." });
    }
    if (newPassword !== confirmPassword) return res.status(400).json({ message: "New passwords do not match." });

    try {
        const admin = await Admin.findById(req.session.adminId).select("+passwordHash");
        if (!await bcrypt.compare(currentPassword, admin.passwordHash)) {
            return res.status(400).json({ message: "Current password is incorrect." });
        }
        if (await bcrypt.compare(newPassword, admin.passwordHash)) {
            return res.status(400).json({ message: "Choose a password different from your current password." });
        }

        admin.passwordHash = await bcrypt.hash(newPassword, 12);
        await admin.save();
        destroySession(req, res, (error) => {
            if (error) return res.status(500).json({ message: "Password changed, but the session could not be cleared. Please log in again." });
            res.json({ message: "Password changed. Please log in again.", redirect: "/admin/login" });
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const uploadedFileField = {
    type: String,
    trim: true,
    default: "",
    validate: {
        validator: (value) => !value || assetPathPattern.test(value),
        message: "Use a file uploaded to this portfolio"
    }
};

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    technologies: { type: [String], default: [] },
    imageUrl: uploadedFileField,
    githubUrl: { type: String, trim: true, default: "" },
    liveUrl: { type: String, trim: true, default: "" },
    featured: { type: Boolean, default: false }
}, { timestamps: true });

const achievementSchema = new mongoose.Schema({
    year: { type: String, trim: true, default: "" },
    title: { type: String, required: true, trim: true },
    organization: { type: String, trim: true, default: "" },
    award: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    imageUrl: uploadedFileField
}, { timestamps: true });

const blogPostSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "" },
    date: { type: String, trim: true, default: "" },
    readingTime: { type: String, trim: true, default: "" },
    excerpt: { type: String, trim: true, default: "" },
    content: { type: String, default: "" },
    coverImageUrl: uploadedFileField,
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false }
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true, default: "" },
    organization: { type: String, trim: true, default: "" },
    text: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    profileImageUrl: uploadedFileField
}, { timestamps: true });

const skillSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "" },
    icon: { type: String, trim: true, default: "fa-solid fa-code" },
    description: { type: String, trim: true, default: "" },
    level: { type: Number, min: 0, max: 100, default: 50 }
}, { timestamps: true });

const experienceSchema = new mongoose.Schema({
    position: { type: String, required: true, trim: true },
    organization: { type: String, trim: true, default: "" },
    startDate: { type: String, trim: true, default: "" },
    endDate: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    technologies: { type: [String], default: [] }
}, { timestamps: true });

const models = {
    projects: mongoose.model("Project", projectSchema),
    achievements: mongoose.model("Achievement", achievementSchema),
    blog: mongoose.model("BlogPost", blogPostSchema),
    reviews: mongoose.model("Review", reviewSchema),
    skills: mongoose.model("Skill", skillSchema),
    experience: mongoose.model("Experience", experienceSchema)
};

app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return requireAdmin(req, res, next);
    next();
});

app.get("/api/:section", async (req, res) => {
    const Model = models[req.params.section];
    if (!Model) return res.status(404).json({ message: "Section not found" });

    try {
        const items = await Model.find().sort({ createdAt: -1 });
        const assetField = assetFields[req.params.section];
        if (assetField) {
            items.forEach((item) => {
                if (item[assetField] && !assetPathPattern.test(item[assetField])) item[assetField] = "";
            });
        }
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

function readSubmittedRecord(req, section) {
    const record = req.body.record ? JSON.parse(req.body.record) : req.body;
    if (req.file && assetFields[section]) {
        record[assetFields[section]] = `/uploads/${req.file.filename}`;
    }
    return record;
}

async function removeUploadedFile(filePath) {
    if (!filePath || !assetPathPattern.test(filePath)) return;
    try {
        await fs.promises.unlink(path.join(uploadDirectory, path.basename(filePath)));
    } catch {}
}

app.post("/api/:section", upload.single("file"), async (req, res) => {
    const Model = models[req.params.section];
    if (!Model) {
        if (req.file) await removeUploadedFile(`/uploads/${req.file.filename}`);
        return res.status(404).json({ message: "Section not found" });
    }
    if (req.file && !assetFields[req.params.section]) {
        await removeUploadedFile(`/uploads/${req.file.filename}`);
        return res.status(400).json({ message: "File uploads are not used in this section." });
    }

    try {
        const item = await Model.create(readSubmittedRecord(req, req.params.section));
        res.status(201).json(item);
    } catch (error) {
        if (req.file) await removeUploadedFile(`/uploads/${req.file.filename}`);
        res.status(400).json({ message: error.message });
    }
});

app.get("/api/:section/:id", async (req, res) => {
    const Model = models[req.params.section];
    if (!Model) return res.status(404).json({ message: "Section not found" });

    try {
        const item = await Model.findById(req.params.id);
        if (!item) return res.status(404).json({ message: "Item not found" });
        const assetField = assetFields[req.params.section];
        if (assetField && item[assetField] && !assetPathPattern.test(item[assetField])) item[assetField] = "";
        res.json(item);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

async function updateItem(req, res) {
    const Model = models[req.params.section];
    if (!Model) return res.status(404).json({ message: "Section not found" });
    if (req.file && !assetFields[req.params.section]) {
        removeUploadedFile(`/uploads/${req.file.filename}`);
        return res.status(400).json({ message: "File uploads are not used in this section." });
    }

    try {
        const previousItem = await Model.findById(req.params.id);
        if (!previousItem) {
            if (req.file) await removeUploadedFile(`/uploads/${req.file.filename}`);
            return res.status(404).json({ message: "Item not found" });
        }
        const assetField = assetFields[req.params.section];
        const record = readSubmittedRecord(req, req.params.section);
        if (req.file && !assetField) {
            await removeUploadedFile(`/uploads/${req.file.filename}`);
            return res.status(400).json({ message: "File uploads are not used in this section." });
        }
        if (assetField && !req.file && !record[assetField]) {
            record[assetField] = assetPathPattern.test(previousItem[assetField] || "") ? previousItem[assetField] : "";
        }
        const item = await Model.findByIdAndUpdate(req.params.id, record, {
            new: true,
            runValidators: true
        });
        if (assetField && previousItem[assetField] !== item[assetField]) await removeUploadedFile(previousItem[assetField]);
        res.json(item);
    } catch (error) {
        if (req.file) await removeUploadedFile(`/uploads/${req.file.filename}`);
        res.status(400).json({ message: error.message });
    }
}

app.put("/api/:section/:id", upload.single("file"), updateItem);
app.patch("/api/:section/:id", upload.single("file"), updateItem);

app.delete("/api/:section/:id", async (req, res) => {
    const Model = models[req.params.section];
    if (!Model) return res.status(404).json({ message: "Section not found" });

    try {
        const item = await Model.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ message: "Item not found" });
        await removeUploadedFile(item[assetFields[req.params.section]]);
        res.json({ message: "Item deleted" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.use((error, req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return res.status(400).json({ message: error.message });
    }
    next(error);
});

// MongoDB Connection
function askHidden(promptText) {
    return new Promise((resolve, reject) => {
        if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
            return reject(new Error("Run the create-admin command in an interactive terminal."));
        }

        let value = "";
        process.stdout.write(promptText);
        process.stdin.setRawMode(true);
        process.stdin.resume();

        function finish(error) {
            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write("\n");
            if (error) reject(error);
            else resolve(value);
        }

        function onData(input) {
            for (const character of input.toString()) {
                if (character === "\u0003") return finish(new Error("Admin setup cancelled."));
                if (character === "\r" || character === "\n") return finish();
                if (character === "\u0008" || character === "\u007f") {
                    if (value.length > 0) {
                        value = value.slice(0, -1);
                        process.stdout.write("\b \b");
                    }
                } else {
                    value += character;
                    process.stdout.write("*");
                }
            }
        }

        process.stdin.on("data", onData);
    });
}

async function createInitialAdmin() {
    try {
        await mongoose.connect(mongoDB);
        if (await Admin.exists({})) throw new Error("An admin account already exists. No changes were made.");

        const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
        const username = (await prompt.question("Admin username (3-32 letters, numbers, dots, dashes, or underscores): ")).trim().toLowerCase();
        prompt.close();
        const password = await askHidden("Admin password (12+ chars, upper/lowercase, number, symbol): ");
        const confirmation = await askHidden("Confirm password: ");

        if (!validUsername(username)) throw new Error("Username must be 3-32 characters using letters, numbers, dots, dashes, or underscores.");
        if (!strongPassword(password)) throw new Error("Password must be 12-128 characters with uppercase, lowercase, a number, and a symbol.");
        if (password !== confirmation) throw new Error("Passwords do not match.");

        await Admin.create({ username, passwordHash: await bcrypt.hash(password, 12) });
        console.log("Admin account created. Start the app with npm start and sign in at /admin/login.");
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

const connectDB = async () => {
    try {
        await mongoose.connect(mongoDB);
        console.log("✅ Connected to MongoDB");
        return true;
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error.message);
        return false;
    }
};

if (process.argv.includes("--create-admin")) {
    createInitialAdmin();
} else {
    connectDB().then((connected) => {
        if (!connected) return;
        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });
    });
}
