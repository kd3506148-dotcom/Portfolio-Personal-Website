# Student portfolio

A responsive student portfolio with an accessible mobile navigation menu, project and education sections, and a contact form powered by a dependency-free Node.js server.

## Run locally

Install [Node.js](https://nodejs.org/), open this folder in a terminal, and run:

```sh
npm start
```

Visit [http://localhost:3000](http://localhost:3000). To choose a different port, set the `PORT` environment variable before starting the server.

## Publish the website

To get a public URL that you can open from anywhere, deploy this project as a web service on [Render](https://render.com/):

1. Upload this project to a GitHub repository. Do not upload `node_modules/` or the `data/` directory.
2. In Render, create a **New Web Service** and connect that GitHub repository.
3. Set the build command to `npm install` and the start command to `npm start`.
4. Deploy the service. Render will provide a public `*.onrender.com` URL; use that URL to visit and share the site.

The service must remain deployed for the public URL to work. The contact form currently saves messages to a local file and does not email them. Unless persistent storage is configured on the host, saved messages may be lost when the service restarts or redeploys.

## Make it yours

Edit `index.html` to replace the sample name, profile, portrait, university, project descriptions, contact email, and social links with your own details. Update `styles.css` to adjust the colors and visual design.

### Add your profile photo

1. Create an `images` folder in the website directory if it does not already exist.
2. Copy your photo into it and name the file `profile.jpg` (PNG and WebP are also supported).
3. In `index.html`, find the image with `class="profile-photo"` and change its `src` to `/images/profile.jpg`.
4. Save the files and refresh the website.

For example, change the image's current `src` to:

```html
src="/images/profile.jpg"
```

The Node.js server only serves JPG, JPEG, PNG, and WebP files placed directly in `images/`. Choose a well-lit portrait photo; the layout automatically crops it to fit the design.

## Contact form

The form submits to `POST /api/contact`. The server validates each submission and appends it to `data/contact-messages.jsonl`. The `data/` directory is excluded from version control and cannot be served as a website asset.

Submissions are stored on the machine hosting this demo; they are not emailed. For a public deployment, configure a secure email or messaging service and add appropriate consent, spam prevention, retention, and privacy information before collecting real visitors' details.
