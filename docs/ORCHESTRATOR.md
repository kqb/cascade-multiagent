# Cascade Orchestrator - Design Document

> A sandboxed multi-agent orchestration system running inside Windsurf

## Vision

Turn Windsurf into a self-contained AI development environment where multiple specialized agents collaborate on complex tasks — like Clawdbot, but sandboxed within the IDE.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cascade Hub UI                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Agent Status    │  Task Queue    │  Activity Feed          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Orchestrator                              │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Planner   │  │  Scheduler  │  │  Synthesizer│               │
│  │             │  │             │  │             │               │
│  │ Decompose   │  │ Assign to   │  │ Merge       │               │
│  │ tasks into  │  │ agents by   │  │ results,    │               │
│  │ subtasks    │  │ capability  │  │ resolve     │               │
│  │             │  │ & load      │  │ conflicts   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   Agent Pool      │ │   Shared Memory   │ │   Safety Layer    │
│                   │ │                   │ │                   │
│ • Scout (recon)   │ │ • Task states     │ │ • File sandboxing │
│ • Builder (code)  │ │ • File changes    │ │ • Approval gates  │
│ • Reviewer (QA)   │ │ • Decisions log   │ │ • Rollback points │
│ • Debugger (fix)  │ │ • Conversations   │ │ • Resource limits │
│ • Optimizer       │ │ • Project context │ │ • Conflict detect │
│ • Tester          │ │                   │ │                   │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

## Core Components

### 1. Orchestrator (`src/orchestrator.js`)

The brain — receives high-level tasks and coordinates agents.

```javascript
class Orchestrator {
  constructor(cascadeHub) {
    this.hub = cascadeHub;        // Cascade Hub connection
    this.agents = new Map();       // Active agent instances
    this.taskQueue = [];           // Pending tasks
    this.memory = new SharedMemory();
    this.planner = new Planner();
    this.scheduler = new Scheduler();
  }

  // Main entry point
  async execute(task) {
    // 1. Plan: decompose into subtasks
    const plan = await this.planner.decompose(task, this.memory);
    
    // 2. Schedule: assign to agents
    const assignments = this.scheduler.assign(plan, this.agents);
    
    // 3. Execute: run agents in parallel/sequence
    const results = await this.runAgents(assignments);
    
    // 4. Synthesize: merge results
    return this.synthesize(results);
  }
}
```

### 2. Agent Definitions (`src/agents/`)

Each agent has:
- **Role**: What it specializes in
- **Capabilities**: What tasks it can handle
- **System prompt**: How it thinks
- **Tools**: What actions it can take

```javascript
// src/agents/scout.js
const Scout = {
  name: 'Scout',
  emoji: '🔍',
  role: 'reconnaissance',
  capabilities: [
    'explore_codebase',
    'find_files',
    'analyze_structure',
    'identify_patterns',
    'map_dependencies'
  ],
  systemPrompt: `You are Scout, a reconnaissance agent.
Your job is to explore and understand codebases.
You analyze structure, find relevant files, and report findings.
You do NOT write code — you gather intelligence for other agents.

When given a task:
1. Identify what information is needed
2. Explore relevant files and directories
3. Summarize findings clearly
4. Suggest which files need modification`,

  temperature: 0.3,  // Lower = more focused
  maxTokens: 4000
};
```

#### Agent Roster

| Agent | Role | Capabilities | When to Use |
|-------|------|--------------|-------------|
| **Scout** 🔍 | Recon | Explore, analyze, map | Understanding codebase, finding files |
| **Builder** 🏗️ | Code | Write, implement, create | New features, implementations |
| **Reviewer** ✅ | QA | Review, critique, suggest | Code review, quality checks |
| **Debugger** 🐛 | Fix | Debug, trace, repair | Bug fixes, error resolution |
| **Optimizer** ⚡ | Perf | Profile, optimize, refactor | Performance, cleanup |
| **Tester** 🧪 | Test | Write tests, verify, validate | Test coverage, validation |

### 3. Shared Memory (`src/memory.js`)

Persistent context across agent interactions.

```javascript
class SharedMemory {
  constructor() {
    this.tasks = new Map();        // Task ID → state
    this.files = new Map();        // File → changes history
    this.decisions = [];           // Decision log
    this.context = {};             // Project-level context
  }

  // Record a file change
  recordChange(agentId, file, change) {
    if (!this.files.has(file)) {
      this.files.set(file, []);
    }
    this.files.get(file).push({
      agent: agentId,
      timestamp: Date.now(),
      change
    });
  }

  // Get context for an agent
  getContextFor(agentId, taskId) {
    return {
      task: this.tasks.get(taskId),
      recentChanges: this.getRecentChanges(),
      relevantDecisions: this.getDecisionsFor(taskId),
      projectContext: this.context
    };
  }
}
```

### 4. Task Queue (`src/queue.js`)

Priority-based task management.

```javascript
class TaskQueue {
  constructor() {
    this.pending = [];    // Waiting to start
    this.active = [];     // Currently running
    this.completed = [];  // Done
    this.failed = [];     // Errored
  }

  enqueue(task, priority = 'normal') {
    const item = {
      id: generateId(),
      task,
      priority,
      status: 'pending',
      createdAt: Date.now(),
      assignedTo: null
    };
    
    // Insert by priority
    const idx = this.pending.findIndex(t => 
      priorityValue(t.priority) < priorityValue(priority)
    );
    this.pending.splice(idx === -1 ? this.pending.length : idx, 0, item);
    
    return item.id;
  }
}
```

### 5. Safety Layer (`src/safety.js`)

Sandboxing and approval gates.

```javascript
class SafetyLayer {
  constructor(config) {
    this.allowedPaths = config.allowedPaths || ['.'];
    this.blockedPaths = config.blockedPaths || ['node_modules', '.git'];
    this.requireApproval = config.requireApproval || ['delete', 'external'];
    this.rollbackPoints = [];
  }

  // Check if operation is allowed
  async checkOperation(op) {
    // Path sandboxing
    if (op.type === 'file') {
      if (!this.isPathAllowed(op.path)) {
        throw new SafetyError(`Path not allowed: ${op.path}`);
      }
    }

    // Approval gates
    if (this.requireApproval.includes(op.category)) {
      const approved = await this.requestApproval(op);
      if (!approved) {
        throw new SafetyError('Operation not approved');
      }
    }

    return true;
  }

  // Create rollback point
  createCheckpoint(label) {
    this.rollbackPoints.push({
      label,
      timestamp: Date.now(),
      state: this.captureState()
    });
  }
}
```

## Communication Protocol

### Inter-Agent Messages

```javascript
// Message format
{
  from: 'scout',
  to: 'builder',          // or 'orchestrator' or 'broadcast'
  type: 'handoff',        // handoff | request | response | status
  taskId: 'task-123',
  payload: {
    findings: [...],
    suggestedFiles: [...],
    context: {...}
  }
}
```

### Agent States

```
IDLE → ASSIGNED → WORKING → REPORTING → IDLE
                     ↓
                  BLOCKED → (waiting for input/approval)
                     ↓
                  FAILED → (error state)
```

## Task Flow Example

**User request:** "Add dark mode support to the settings page"

```
1. ORCHESTRATOR receives task

2. PLANNER decomposes:
   ├── [scout] Find settings page components
   ├── [scout] Check existing theme implementation
   ├── [builder] Implement dark mode toggle
   ├── [builder] Add dark mode styles
   ├── [tester] Write tests for toggle
   └── [reviewer] Review implementation

3. SCHEDULER assigns:
   • Scout-1 → Find components (parallel)
   • Scout-2 → Check theme system (parallel)
   • Builder-1 → Wait for scout results
   • ...

4. EXECUTION:
   Scout-1: "Found SettingsPage.tsx, uses ThemeContext"
   Scout-2: "Theme uses CSS variables, light mode only"
        ↓
   Builder-1: Implements toggle component
   Builder-2: Adds dark mode CSS variables
        ↓
   Tester: Writes toggle tests
        ↓
   Reviewer: "LGTM, minor suggestion on naming"
        ↓
   Builder-1: Applies feedback

5. SYNTHESIZE:
   • All tests pass
   • Code reviewed
   • Changes summarized for user
```

## UI Integration

The Cascade Hub UI shows:

```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Current Task: Add dark mode support                  │
│ ████████████░░░░░░░░ 60% complete                       │
├─────────────────────────────────────────────────────────┤
│ 🔍 Scout-1      ✅ Done    Found 3 relevant files       │
│ 🔍 Scout-2      ✅ Done    Theme system mapped          │
│ 🏗️ Builder-1    ⚙️ Working Implementing toggle...       │
│ 🏗️ Builder-2    ⏳ Waiting  Needs Builder-1 result      │
│ 🧪 Tester       ⏳ Waiting  Needs implementation        │
│ ✅ Reviewer     ⏳ Waiting  Needs code to review        │
├─────────────────────────────────────────────────────────┤
│ 📝 Activity Feed                                        │
│ • Scout-1 found SettingsPage.tsx                        │
│ • Scout-2 mapped ThemeContext structure                 │
│ • Builder-1 creating DarkModeToggle component...        │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
cascade-multiagent/
├── src/
│   ├── orchestrator.js      # Main coordinator
│   ├── planner.js           # Task decomposition
│   ├── scheduler.js         # Agent assignment
│   ├── memory.js            # Shared state
│   ├── queue.js             # Task queue
│   ├── safety.js            # Sandboxing
│   ├── agents/
│   │   ├── base.js          # Base agent class
│   │   ├── scout.js         # 🔍 Recon agent
│   │   ├── builder.js       # 🏗️ Code agent
│   │   ├── reviewer.js      # ✅ Review agent
│   │   ├── debugger.js      # 🐛 Debug agent
│   │   ├── optimizer.js     # ⚡ Perf agent
│   │   └── tester.js        # 🧪 Test agent
│   ├── protocols/
│   │   ├── handoff.js       # Agent handoff protocol
│   │   ├── conflict.js      # Conflict resolution
│   │   └── approval.js      # Human approval flow
│   └── ui/
│       ├── hub.js           # Main UI shell
│       ├── task-view.js     # Task progress
│       └── activity-feed.js # Live activity
├── docs/
│   ├── ORCHESTRATOR.md      # This document
│   ├── AGENTS.md            # Agent specifications
│   └── API.md               # Public API
└── examples/
    ├── simple-task.js       # Basic usage
    └── complex-flow.js      # Multi-agent workflow
```

## Configuration

```javascript
// cascade.config.js
module.exports = {
  orchestrator: {
    maxConcurrentAgents: 4,
    defaultTimeout: 60000,
    retryAttempts: 2
  },
  
  safety: {
    allowedPaths: ['.'],
    blockedPaths: ['node_modules', '.git', '.env'],
    requireApproval: ['delete', 'external', 'install'],
    maxFileSize: '1MB'
  },
  
  agents: {
    scout: { instances: 2, temperature: 0.3 },
    builder: { instances: 2, temperature: 0.7 },
    reviewer: { instances: 1, temperature: 0.5 },
    debugger: { instances: 1, temperature: 0.5 },
    optimizer: { instances: 1, temperature: 0.5 },
    tester: { instances: 1, temperature: 0.5 }
  },
  
  memory: {
    persistence: 'file',        // 'file' | 'memory' | 'sqlite'
    path: '.cascade/memory.json'
  }
};
```

## Implementation Phases

### Phase 1: Foundation ✅
- [x] CDP connection to Windsurf
- [x] Custom UI mounting
- [x] Panel spawning
- [x] Basic send/receive

### Phase 2: Orchestrator Core
- [ ] Orchestrator class
- [ ] Task queue
- [ ] Shared memory
- [ ] Basic planner (single agent)

### Phase 3: Multi-Agent
- [ ] Agent definitions
- [ ] Parallel execution
- [ ] Agent handoff protocol
- [ ] Conflict resolution

### Phase 4: Intelligence
- [ ] Smart task decomposition
- [ ] Capability-based scheduling
- [ ] Result synthesis
- [ ] Learning from outcomes

### Phase 5: Safety & Polish
- [ ] Path sandboxing
- [ ] Approval gates
- [ ] Rollback points
- [ ] Full UI integration

## API Preview

```javascript
const { Orchestrator } = require('cascade-multiagent');

// Initialize
const orch = new Orchestrator({
  port: 9333,
  config: './cascade.config.js'
});

await orch.connect();

// Execute a task
const result = await orch.execute({
  description: 'Add dark mode support to settings page',
  constraints: {
    mustTest: true,
    mustReview: true
  }
});

// Monitor progress
orch.on('progress', (event) => {
  console.log(`[${event.agent}] ${event.status}: ${event.message}`);
});

// Manual agent control
const scout = await orch.spawnAgent('scout');
await scout.send('Find all React components using ThemeContext');
const findings = await scout.waitForResponse();
```

## Open Questions

1. **Cascade API Limits**: How many concurrent panels can Windsurf handle?
2. **Context Sharing**: How to efficiently share large contexts between agents?
3. **Conflict Resolution**: When two builders edit the same file, who wins?
4. **Cost Management**: How to track/limit token usage across agents?
5. **Persistence**: Should memory persist across Windsurf restarts?

---

*Next step: Implement Phase 2 - Orchestrator Core*
