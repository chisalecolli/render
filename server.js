const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const BUILDS_DIR = path.join(__dirname, 'public', 'builds');
if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
}

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).send('SpeedAI Cloud Java-to-JAR Compiler Online');
});

app.get('/ping', (req, res) => {
    res.json({ ok: true, status: 'SpeedAI Compiler Ready' });
});

// Explicit file download route
app.get('/builds/:file', (req, res) => {
    const filePath = path.join(BUILDS_DIR, req.params.file);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/java-archive');
        return res.download(filePath, req.params.file);
    }
    return res.status(404).send('File not found or expired.');
});

// Compilation endpoint
app.post('/compile', (req, res) => {
    const { code, appName } = req.body;

    if (!code || code.trim().length < 30) {
        return res.status(400).json({ ok: false, error: 'No Java code provided' });
    }

    let mainClass = 'SpeedApp';
    const match = code.match(/public\s+class\s+(\w+)/);
    if (match && match[1]) {
        mainClass = match[1];
    }
    const cleanAppName = (appName || mainClass).replace(/[^a-zA-Z0-9_]/g, '');

    const stamp = Date.now();
    const workDir = path.join(__dirname, 'tmp', `${cleanAppName}_${stamp}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
        const javaFile = path.join(workDir, `${mainClass}.java`);
        fs.writeFileSync(javaFile, code, 'utf8');

        const manifestContent = 
`Manifest-Version: 1.0
MIDlet-1: ${cleanAppName}, , ${mainClass}
MIDlet-Name: ${cleanAppName}
MIDlet-Vendor: SpeedAI
MIDlet-Version: 1.0.0
MicroEdition-Configuration: CLDC-1.1
MicroEdition-Profile: MIDP-2.0
`;
        const manifestFile = path.join(workDir, 'MANIFEST.MF');
        fs.writeFileSync(manifestFile, manifestContent, 'utf8');

        const stubsPath = path.join(__dirname, 'midpapi20.jar');
        let compileCmd = `javac *.java`;
        if (fs.existsSync(stubsPath)) {
            compileCmd = `javac -cp "${stubsPath}:." *.java`;
        }

        exec(compileCmd, { cwd: workDir }, (compileErr, stdout, stderr) => {
            if (compileErr) {
                fs.rmSync(workDir, { recursive: true, force: true });
                return res.json({ ok: false, error: `Compile Error: ${stderr || compileErr.message}` });
            }

            const jarName = `${cleanAppName}_${stamp}.jar`;
            const jarPath = path.join(BUILDS_DIR, jarName);
            const jarCmd = `jar cfm "${jarPath}" MANIFEST.MF *.class`;

            exec(jarCmd, { cwd: workDir }, (jarErr) => {
                if (jarErr) {
                    fs.rmSync(workDir, { recursive: true, force: true });
                    return res.json({ ok: false, error: 'JAR packaging failed' });
                }

                // Read binary bytes and return Base64 for permanent storage
                const jarBytes = fs.readFileSync(jarPath);
                const jarB64 = jarBytes.toString('base64');
                const jarSize = jarBytes.length;

                fs.rmSync(workDir, { recursive: true, force: true });

                return res.json({
                    ok: true,
                    appName: cleanAppName,
                    mainClass: mainClass,
                    jar_name: `${cleanAppName}.jar`,
                    jar_b64: jarB64,
                    size: jarSize
                });
            });
        });

    } catch (e) {
        fs.rmSync(workDir, { recursive: true, force: true });
        return res.status(500).json({ ok: false, error: e.message });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Compiler running on port ${PORT}`));
