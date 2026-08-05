# Frontend Setup

This guide walks you through setting up and running the Veritas frontend locally.

## Prerequisites

Before you begin, ensure you have the following installed:

* **Node.js**: v20 LTS or v22 LTS (recommended)
* **npm**: v10 or later
* *(Optional)* **nvm** for managing Node.js versions

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/bcd-veritas/vertitas-frontend-v2.git
cd vertitas-frontend-v2
```

### 2. Install dependencies

If you use **nvm**, switch to a supported Node.js version first:

```bash
nvm use 20
# or
nvm use 22
```

Then install the project dependencies:

```bash
npm install
```

---

### 3. Configure environment variables

Create your local environment files from the provided templates:

```bash
cp .env.development.example .env.development
cp .env.production.example .env.production
```

Update the environment variables with the appropriate values.

> **Tip:** If you want to run the application using the production configuration, you may copy the production environment values into `.env.development`.

---

### 4. Start the development server

```bash
npm run dev
```

Once the server has started, open your browser and navigate to:

```
http://localhost:3001
```

---

# Available Scripts

| Command         | Description                                   |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Starts the development server.                |
| `npm run build` | Builds the application for production.        |
| `npm run start` | Serves the production build on port **3001**. |
| `npm run lint`  | Runs ESLint to check code quality.            |
