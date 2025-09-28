# TaskFlow - Dark Task Dashboard

A modern, responsive task management dashboard with a dark theme and animated robot background. Built with vanilla JavaScript, Node.js, and PostgreSQL.

## Features

### Core Functionality
- **Three-Column Kanban Board**: To Do, In Progress, Done
- **High-Performance Drag & Drop**: 120fps target with transform3d optimization
- **Full CRUD Operations**: Create, read, update, delete tasks
- **Advanced Filtering**: Status, category, priority, and fuzzy search
- **Keyboard Shortcuts**: Ctrl+N (new task), Ctrl+D (delete), Ctrl+F (search), Esc (cancel)
- **Offline-First**: localStorage/IndexedDB with server sync
- **Real-time Updates**: Automatic sync when connection is restored

### Design & UX
- **Dark Theme**: Near-black background (#0B0B0C) with cyan accents (#58C7D2)
- **Animated Background**: Canvas-based robot sprites with parallax motion (toggleable)
- **Responsive Design**: Desktop, tablet, and mobile layouts
- **Micro-interactions**: Hover states, transitions, and visual feedback
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Technical Features
- **Performance Optimized**: RequestAnimationFrame-based animations
- **Modular Architecture**: Clean separation of concerns
- **TypeScript-Ready**: JSDoc annotations for better IDE support
- **Production Ready**: Minification, compression, error handling

## Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- PostgreSQL 12+ database
- Modern web browser with ES6+ support

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd taskflow
   npm install
   cd server && npm install
   ```

2. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb taskflow_db
   
   # Copy environment file
   cp .env.example .env
   
   # Edit .env with your database credentials
   nano .env
   ```

3. **Start Development Server**
   ```bash
   # Terminal 1: Start backend
   cd server
   npm run dev
   
   # Terminal 2: Start frontend (if using a dev server)
   npm run dev
   ```

4. **Access Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Demo login: username=`demo`, password=`demo123`

## Project Structure

```
taskflow/
├── index.html              # Main HTML file
├── styles/
│   └── main.css            # All styles (dark theme)
├── js/
│   ├── app.js              # Main application entry
│   ├── store/              # Data management
│   │   ├── TaskManager.js  # Task CRUD operations
│   │   ├── StorageManager.js # Local storage/IndexedDB
│   │   └── ApiClient.js    # Server communication
│   ├── utils/              # Utilities
│   │   ├── DragManager.js  # High-performance drag & drop
│   │   └── KeyboardManager.js # Keyboard shortcuts
│   ├── ui/                 # UI components
│   │   ├── UIManager.js    # UI state management
│   │   ├── ToastManager.js # Notifications
│   │   ├── ModalManager.js # Modal dialogs
│   │   └── FilterManager.js # Filtering & search
│   └── bg/
│       └── CanvasBackground.js # Animated robot background
├── server/                 # Node.js backend
│   ├── index.js           # Express server
│   ├── routes/            # API routes
│   │   ├── auth.js        # Authentication
│   │   ├── tasks.js       # Task operations
│   │   └── sync.js        # Data synchronization
│   ├── db/
│   │   └── schema.sql     # Database schema
│   └── package.json       # Server dependencies
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Tasks
- `GET /api/tasks` - Get all tasks (with filtering)
- `GET /api/tasks/:id` - Get specific task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/batch` - Batch operations

### Sync
- `POST /api/sync` - Sync client tasks with server
- `GET /api/sync/status` - Get sync status
- `GET /api/sync/full` - Force full sync

## Configuration

### Environment Variables
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost/taskflow_db

# Security
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

### Robot Background Settings
The animated robot background can be configured:

```javascript
// In CanvasBackground.js
config: {
    robotCount: 15,        // Number of robots
    speed: 0.5,           // Movement speed
    spriteSize: 32,       // Robot size in pixels
    animationSpeed: 8     // Animation frame rate
}
```

### Performance Modes
- **High**: 60fps, 20 robots, full effects
- **Medium**: 45fps, 15 robots, reduced effects  
- **Low**: 30fps, 10 robots, minimal effects

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Create new task |
| `Ctrl+D` | Delete selected task |
| `Ctrl+F` | Focus search |
| `Esc` | Cancel/Close modal |
| `Ctrl+1/2/3` | Focus columns |
| `Alt+H` | Show shortcuts help |

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance Features

### Drag & Drop Optimization
- Uses `transform3d()` for GPU acceleration
- RequestAnimationFrame for smooth 120fps
- Pointer events for better touch support
- Minimal DOM manipulation during drag

### Canvas Background
- Offscreen rendering for better performance
- Respects `prefers-reduced-motion`
- Automatic performance scaling
- Pause on page visibility change

### Data Management
- IndexedDB with localStorage fallback
- Optimistic updates for instant feedback
- Background sync with conflict resolution
- Efficient filtering and sorting

## Deployment

### Production Build
```bash
# Build optimized version
npm run build

# Start production server
NODE_ENV=production npm start
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure secure `JWT_SECRET`
3. Set up PostgreSQL with SSL
4. Configure reverse proxy (nginx)
5. Enable HTTPS

## Development

### Code Style
- ES6+ modules with clean imports/exports
- JSDoc comments for documentation
- Consistent naming conventions
- Error handling with try/catch

### Testing
```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Contributing
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string
psql $DATABASE_URL
```

**Canvas Background Not Working**
- Check browser console for WebGL errors
- Verify `prefers-reduced-motion` setting
- Try disabling hardware acceleration

**Drag & Drop Issues**
- Ensure pointer events are supported
- Check for conflicting CSS `touch-action`
- Verify element positioning

### Performance Issues
- Enable performance mode in settings
- Reduce robot count in canvas config
- Check browser dev tools for bottlenecks

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: [Report bugs](https://github.com/taskflow/issues)
- Documentation: [Wiki](https://github.com/taskflow/wiki)
- Discussions: [Community](https://github.com/taskflow/discussions)

---

Built with ❤️ using vanilla JavaScript, Node.js, and modern web technologies.