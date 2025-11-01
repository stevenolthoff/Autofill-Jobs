<!-- <div align="center">

https://github.com/user-attachments/assets/13f0fb66-7436-40ff-8faf-c2540084337b

<h1 align="center">
  Autofill Jobs
</h1>
  <p>
  A chrome extension that autofills job applications, built with 
  <a href="https://vuejs.org/">Vue</a>.
</p>
</div> -->

Of course. This version frames the project as a major enhancement of a fork, highlights your specific contributions like answer clustering, and explains the suggestion algorithm in simple terms without using the "AI" buzzword.

---

# Autofill Jobs 🚀

A browser extension to automatically fill in job applications, rebuilt for smarter and faster use.

This project is a significant evolution of an earlier autofill extension, completely overhauled with intelligent answer management, a modern UI, and broader site compatibility.

## Key Enhancements in This Version

*   **Intelligent Answer Clustering**: Instead of just saving one-to-one answers, this version is smarter. It clusters similar questions (like *"Why this role?"* and *"What makes you a good fit?"*) together. When you update your answer for one, it becomes the new go-to answer for that entire topic.

*   **Context-Aware Suggestions**: The extension finds your most relevant saved answer by understanding the *meaning* of the new question on a form, not just by matching keywords. On sites with very strict security policies, it gracefully falls back to a simple word-overlap matching algorithm to ensure you still get helpful suggestions.

*   **Automatic Resume Parsing**: With a Google Gemini API key, it reads your resume to auto-populate your skills and work experience, saving you manual data entry.

*   **Modern & Usable UI**: The user interface has been completely redesigned with Vue 3 and Tailwind CSS for a clean, intuitive experience.

*   **Expanded Site Support**: Now works reliably on more job boards, including Ashby, Greenhouse, and Workday.

## Supported Platforms

*   Greenhouse
*   Lever
*   Workday
*   Dover
*   Ashby

## Installation

This extension is not on the Chrome Web Store. To install for development or personal use:

1.  Clone or download this repository.
2.  Run `npm install` and then `npm run build` to create the `dist` folder.
3.  Open your browser, navigate to `chrome://extensions`, and enable "Developer mode".
4.  Click "Load unpacked" and select the `dist` folder from this project.

## Usage

1.  Pin the extension to your toolbar.
2.  Open the popup and fill in your details. Data is saved automatically.
3.  Navigate to a job application on a supported site, and the extension will fill the form.

## Development

*   **Stack**: Vue 3, TypeScript, Tailwind CSS, Vite
*   **Run Dev Build**: `npm run watch`
    *   This command watches for changes and rebuilds the `dist/` folder. Reload the extension in `chrome://extensions` to see your changes.
