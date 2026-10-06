// index.html, style.css and script.js are the canonical public website sources.
// Keep the existing React site and GitHub Pages copies consistent.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
const html = readFileSync('index.html','utf8');
const body = html.split('<body id="top">')[1].split('</body>')[0].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replaceAll('public/','/');
const page = `"use client";\nimport { useEffect } from "react";\nconst markup = ${JSON.stringify(body)};\nexport default function Home() {\n useEffect(() => {\n  if (document.getElementById('calm-runtime')) return;\n  const script = document.createElement('script');\n  script.id = 'calm-runtime'; script.src = '/calm-runtime.js';\n  document.body.append(script);\n }, []);\n return <div id="top" dangerouslySetInnerHTML={{ __html: markup }} />;\n}\n`;
writeFileSync('app/page.tsx',page);
writeFileSync('app/globals.css',readFileSync('style.css','utf8'));
writeFileSync('public/calm-runtime.js',readFileSync('booking-config.js','utf8')+'\n'+readFileSync('script.js','utf8'));
for (const file of ['style.css','privacy.html','terms.html']) copyFileSync(file,`public/${file}`);
mkdirSync('dist/public',{recursive:true});
for (const file of ['index.html','style.css','script.js','booking-config.js','privacy.html','terms.html','robots.txt','sitemap.xml']) copyFileSync(file,`dist/${file}`);
for (const file of ['therapy-room.png','calm-collective-warwick-clean.webp','calm-collective-window.png','favicon.svg']) copyFileSync(`public/${file}`,`dist/public/${file}`);
