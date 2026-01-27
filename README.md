# Toolkit

A simple web app I built because I was tired of:
- Paying for basic PDF operations
- Sketchy online PDF sites that probably steal your data
- Tools that require account creation for simple tasks
- Complicated software installs just to merge two PDFs

This runs entirely in your browser, so your files stay on your device. No uploads, no accounts, no nothing.

## Current Features

Right now it does the basic stuff I needed:

- **Merge PDFs** - Combine multiple PDFs
- **Split PDFs** - Break a PDF into pages
- **Rotate Pages** - Fix sideways PDFs
- **Images to PDF** - Turn screenshots/images into a PDF
- **PDF to Images** - Extract pages as images
- **Compress PDFs** - Make files smaller

## Why I Built This

I got sick of those "3 free uses then pay $9.99/month" PDF sites. All I wanted to do was merge a couple documents for a project. So I spent a weekend learning how to do it myself.

Turns out it's not that hard - there are JavaScript libraries that handle all the PDF stuff. I just needed to build a UI around them.

## Tech Stack

- React - for the UI
- pdf-lib - does the actual PDF manipulation
- PDF.js - renders PDFs (for the PDF to images feature)
- Vite - build tool
- Tailwind CSS - styling (mostly inline styles though)

## Running It Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Future Plans

I'll add more features as I need them:
- Password-protected PDFs (lots of people have requested this)
- Page range selection for splitting
- Reorder pages in a PDF
- Remove specific pages
- Better compression options
- Maybe some image editing tools?

No timeline on these - I add stuff when I personally need it or when I'm bored.

## Privacy

Everything happens in your browser. No servers, no tracking, no data collection. I literally couldn't see your files even if I wanted to.

## Known Issues

- Encrypted PDFs with user passwords won't work (there's a guide in the project for how to remove passwords first)
- Large PDFs (100+ MB) can be slow - that's just browser limitations
- Some really old or weirdly formatted PDFs might not work

## Contributing

Feel free to fork it and add features. If you make something cool, send a pull request.

## License

Do whatever you want with it. MIT License I guess.
