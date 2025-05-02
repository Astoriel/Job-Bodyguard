'use client';

import Link from 'next/link';

export default function Home(): JSX.Element {
  return (
    <main className="landing">
      <nav className="nav">
        <div className="container nav-content">
          <Link href="/" className="logo">
            <span className="logo-icon">🛡️</span>
            <span className="logo-text">Job Bodyguard</span>
          </Link>
          <div className="nav-links">
            <Link href="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Decode Job Postings.<br />
              <span className="gradient-text">Protect Your Career.</span>
            </h1>
            <p className="hero-subtitle">
              AI-powered Chrome extension that finds hidden red flags,
              decodes corporate speak, and tailors your resume for every application.
            </p>
            <div className="hero-buttons">
              <a href="#install" className="btn btn-primary">
                🚀 Install Extension
              </a>
              <Link href="/dashboard" className="btn btn-secondary">
                📊 View Dashboard
              </Link>
            </div>
          </div>

          <div className="features">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Passive Scan</h3>
              <p>Automatically detects hidden salary, job age, and red flags</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Analysis</h3>
              <p>Get a sarcastic roast of corporate buzzwords</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">✂️</div>
              <h3>Resume Tailor</h3>
              <p>Optimize your resume for each specific job</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Track Applications</h3>
              <p>Keep all your applications organized in one place</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
