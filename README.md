# DesignBase
A full-stack platform to archive and search design project assets using metadata and AI summaries.
# DesignBase

DesignBase is a full-stack platform to help architecture and design teams **archive, search, and reuse project assets** such as images, diagrams, and notes. By leveraging structured metadata and AI-generated summaries, DesignBase makes design knowledge more discoverable and reusable across teams and phases.

## Features

- Upload and organize design visuals with custom metadata
- Semantic keyword tagging via OpenAI API
- Project filtering by phase, type, and content
- Secure user authentication and storage using Supabase
- Built with Next.js, TypeScript, Tailwind CSS, PostgreSQL

## Tech Stack

- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: Supabase (auth, storage, PostgreSQL)
- AI: OpenAI Embedding API
- CI/CD: GitHub Actions (planned)

## Roadmap

- [ ] Build MVP dashboard UI  
- [ ] Implement metadata tagging system  
- [ ] Integrate OpenAI API for semantic summaries  
- [ ] Search by tag / keyword / project phase  
- [ ] Role-based access & admin panel

## Folder Structure (Planned)

designbase/
├── app/ # Next.js app directory
├── components/ # Reusable UI components
├── lib/ # Utilities and API handlers
├── pages/ # Routing (if app dir not used)
├── public/ # Static files
└── supabase/ # Database schema & config

## License

MIT License
