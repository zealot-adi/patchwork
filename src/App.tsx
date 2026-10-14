import { useEffect, useState } from "react";
import "./App.css";

type ItemType = "Task" | "Note" | "Link";
type Priority = "Low" | "Medium" | "High";

type Item = {
  id: number;
  title: string;
  description: string;
  type: ItemType;
  color: string;
  completed?: boolean;
  priority?: Priority;
  dueDate?: string;
};

const STORAGE_KEY = "patchwork-items";

// A genuinely new workspace starts empty.
const initialItems: Item[] = [];

function isPriority(value: unknown): value is Priority {
  return value === "Low" || value === "Medium" || value === "High";
}

function isItemType(value: unknown): value is ItemType {
  return value === "Task" || value === "Note" || value === "Link";
}

function loadItems(): Item[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) {
      return initialItems;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return initialItems;
    }

    return parsed
      .filter((raw: unknown): raw is Item => {
        if (typeof raw !== "object" || raw === null) {
          return false;
        }

        const item = raw as Partial<Item>;

        return (
          typeof item.id === "number" &&
          typeof item.title === "string" &&
          typeof item.description === "string" &&
          isItemType(item.type)
        );
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        type: item.type,
        color:
          typeof item.color === "string" ? item.color : "blue",
        completed:
          item.type === "Task" ? Boolean(item.completed) : undefined,
        priority:
          item.type === "Task"
            ? isPriority(item.priority)
              ? item.priority
              : "Medium"
            : undefined,
        dueDate:
          item.type === "Task" && typeof item.dueDate === "string"
            ? item.dueDate
            : "",
      }));
  } catch (error) {
    console.error("Could not load PATCHWORK items:", error);
    return initialItems;
  }
}

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [items, setItems] = useState<Item[]>(loadItems);

  const [activeFilter, setActiveFilter] = useState("All items");
  const [search, setSearch] = useState("");
  const [showCapture, setShowCapture] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ItemType>("Task");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState("");

  // Save items whenever the workspace changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Could not save PATCHWORK items:", error);
    }
  }, [items]);

  // Dashboard statistics.
  const tasks = items.filter((item) => item.type === "Task");

  const completedTasks = tasks.filter((item) => item.completed);

  const remainingTasks = tasks.length - completedTasks.length;

  const overdueTasks = tasks.filter(
    (item) =>
      !item.completed &&
      Boolean(item.dueDate) &&
      item.dueDate! < getLocalDate(),
  );

  const notes = items.filter((item) => item.type === "Note");
  const links = items.filter((item) => item.type === "Link");

  const progress =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks.length / tasks.length) * 100);

  // Search and filtering.
  const filteredItems = items
    .filter((item) => {
      let matchesFilter = true;

      switch (activeFilter) {
        case "Tasks":
          matchesFilter = item.type === "Task";
          break;
        case "Notes":
          matchesFilter = item.type === "Note";
          break;
        case "Links":
          matchesFilter = item.type === "Link";
          break;
        case "Overdue":
          matchesFilter = overdueTasks.some(
            (overdue) => overdue.id === item.id,
          );
          break;
        default:
          matchesFilter = true;
      }

      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        item.title.toLowerCase().includes(searchText) ||
        item.description.toLowerCase().includes(searchText);

      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      // Keep non-task items in their existing order.
      if (a.type !== "Task" || b.type !== "Task") {
        return 0;
      }

      // Incomplete tasks appear before completed tasks.
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Higher-priority tasks appear first.
      const rank: Record<Priority, number> = {
        High: 0,
        Medium: 1,
        Low: 2,
      };

      const priorityDifference =
        rank[a.priority ?? "Medium"] -
        rank[b.priority ?? "Medium"];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      // Earlier deadlines appear first.
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return 0;
    });

  function resetForm() {
    setTitle("");
    setDescription("");
    setType("Task");
    setPriority("Medium");
    setDueDate("");
  }

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle) {
      return;
    }

    // Validate links before saving.
    if (type === "Link") {
      try {
        const url = new URL(cleanDescription);

        if (url.protocol !== "https:" && url.protocol !== "http:") {
          alert("Please enter a valid HTTP or HTTPS URL.");
          return;
        }
      } catch {
        alert("Enter a complete URL, such as https://react.dev/");
        return;
      }
    }

    const newItem: Item = {
      id: Date.now(),
      title: cleanTitle,
      description: cleanDescription || "No description added yet.",
      type,
      color:
        type === "Task"
          ? "purple"
          : type === "Note"
            ? "blue"
            : "green",
      completed: type === "Task" ? false : undefined,
      priority: type === "Task" ? priority : undefined,
      dueDate: type === "Task" ? dueDate : undefined,
    };

    setItems((current) => [newItem, ...current]);

    resetForm();
    setShowCapture(false);
    setActiveFilter("All items");
    setSearch("");
  }

  function deleteItem(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function toggleTask(id: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.type === "Task"
          ? { ...item, completed: !item.completed }
          : item,
      ),
    );
  }

  function isOverdue(item: Item): boolean {
    return Boolean(
      item.type === "Task" &&
        !item.completed &&
        item.dueDate &&
        item.dueDate < getLocalDate(),
    );
  }

  function formatDate(date: string): string {
    if (!date) {
      return "";
    }

    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function openCapture() {
    resetForm();
    setShowCapture(true);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setActiveFilter("All items");
            setSearch("");
          }}
          aria-label="PATCHWORK home"
        >
          <span className="brand-icon">p.</span>
          <span>patchwork</span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">P</span>

          <span className="workspace-name">
            <strong>Personal space</strong>
            <small>Free workspace</small>
          </span>

          <span className="switcher-arrow">⌄</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="navigation">
          {[
            { name: "All items", icon: "◫", count: items.length },
            { name: "Tasks", icon: "☑", count: remainingTasks },
            { name: "Notes", icon: "▤", count: notes.length },
            { name: "Links", icon: "↗", count: links.length },
            { name: "Overdue", icon: "⚠", count: overdueTasks.length },
          ].map((entry) => (
            <button
              key={entry.name}
              className={`nav-item ${
                activeFilter === entry.name ? "active" : ""
              }`}
              onClick={() => setActiveFilter(entry.name)}
            >
              <span>{entry.icon}</span>
              {entry.name}
              <span className="nav-count">{entry.count}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">YOUR SPACE</div>

          <div className="space-card">
            <span className="space-dot" />
            <div>
              <strong>Getting started</strong>
              <small>Your first workspace</small>
            </div>
          </div>

          <div className="profile">
            <div className="profile-avatar">Y</div>
            <div className="profile-info">
              <strong>Your workspace</strong>
              <small>Personal account</small>
            </div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <span>/</span> <strong>{activeFilter}</strong>
          </div>

          <div className="topbar-actions">
            <span className="status-indicator">
              <span />
              Workspace ready
            </span>

            <button className="avatar-small" aria-label="Your profile">
              Y
            </button>
          </div>
        </header>

        <section className="content-area">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                YOUR SECOND BRAIN
              </div>

              <h1>
                Make space for <span>good ideas.</span>
              </h1>

              <p className="subtitle">
                All your thoughts, tasks, and resources. Finally, together.
              </p>
            </div>

            <button className="primary-button" onClick={openCapture}>
              <span>＋</span>
              Quick capture
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple-icon">◫</div>
              <div className="stat-label">TOTAL ITEMS</div>
              <div className="stat-number">{items.length}</div>
              <div className="stat-caption">Across your workspace</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green-icon">✓</div>
              <div className="stat-label">TASKS REMAINING</div>
              <div className="stat-number">{remainingTasks}</div>
              <div className="stat-caption">
                {completedTasks.length} of {tasks.length} completed
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue-icon">◴</div>
              <div className="stat-label">TASK PROGRESS</div>
              <div className="stat-number">{progress}%</div>

              <div
                className="progress-track"
                role="progressbar"
                aria-label="Task completion"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="stat-caption">
                {overdueTasks.length} overdue
              </div>
            </div>
          </div>

          <section className="items-section">
            <div className="section-heading">
              <div>
                <h2>Your workspace</h2>
                <p>A little organization goes a long way.</p>
              </div>

              <label className="search-box">
                <span>⌕</span>
                <input
                  aria-label="Search items"
                  placeholder="Find something..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <kbd>/</kbd>
              </label>
            </div>

            <div className="filter-row">
              {["All items", "Tasks", "Notes", "Links", "Overdue"].map(
                (filter) => (
                  <button
                    key={filter}
                    className={`filter-chip ${
                      activeFilter === filter ? "selected" : ""
                    }`}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                    {filter === "All items" && <span>{items.length}</span>}
                  </button>
                ),
              )}
            </div>

            {filteredItems.length > 0 ? (
              <div className="items-grid">
                {filteredItems.map((item) => (
                  <article
                    className={`item-card ${
                      item.completed ? "task-completed" : ""
                    }`}
                    key={item.id}
                  >
                    <div className="item-card-top">
                      {item.type === "Task" ? (
                        <button
                          className={`item-icon ${item.color} task-checkbox ${
                            item.completed ? "checked" : ""
                          }`}
                          onClick={() => toggleTask(item.id)}
                          aria-label={
                            item.completed
                              ? "Mark task incomplete"
                              : "Mark task complete"
                          }
                        >
                          {item.completed ? "✓" : ""}
                        </button>
                      ) : (
                        <span className={`item-icon ${item.color}`}>
                          {item.type === "Note" ? "▤" : "↗"}
                        </span>
                      )}

                      {item.type === "Task" ? (
                        <span
                          className={`priority-badge priority-${(
                            item.priority ?? "Medium"
                          ).toLowerCase()}`}
                        >
                          {item.priority ?? "Medium"} priority
                        </span>
                      ) : (
                        <span className={`type-badge ${item.color}`}>
                          {item.type}
                        </span>
                      )}

                      <button
                        className="more-button"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => deleteItem(item.id)}
                      >
                        ×
                      </button>
                    </div>

                    <h3>{item.title}</h3>

                    {item.type === "Link" ? (
                      <a
                        className="item-description saved-link"
                        href={item.description}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.description}
                      </a>
                    ) : (
                      <p className="item-description">{item.description}</p>
                    )}

                    {item.type === "Task" && item.dueDate && (
                      <div
                        className={`due-date ${
                          isOverdue(item) ? "overdue" : ""
                        }`}
                      >
                        <span>◷</span>
                        {isOverdue(item) ? "Overdue · " : "Due "}
                        {formatDate(item.dueDate)}
                      </div>
                    )}

                    <div className="item-footer">
                      <span className="item-owner">
                        <span className="tiny-avatar">Y</span>
                        You
                      </span>

                      <span className="item-arrow">
                        {item.type === "Task"
                          ? item.completed
                            ? "✓ Done"
                            : "○ To do"
                          : "↗"}
                      </span>
                    </div>
                  </article>
                ))}

                <button className="add-card" onClick={openCapture}>
                  <span>＋</span>
                  <strong>Add something new</strong>
                  <small>Capture a thought before it gets away.</small>
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  {search ? "⌕" : activeFilter === "Overdue" ? "✓" : "＋"}
                </div>

                <h3>
                  {search
                    ? "No matching items"
                    : activeFilter === "Overdue"
                      ? "You're all caught up"
                      : activeFilter === "All items"
                        ? "Your workspace starts here"
                        : `No ${activeFilter.toLowerCase()} yet`}
                </h3>

                <p>
                  {search
                    ? "Try a different search term."
                    : activeFilter === "Overdue"
                      ? "You have no overdue tasks."
                      : "Capture your first idea, task, or useful link."}
                </p>

                {!search && activeFilter !== "Overdue" && (
                  <button className="primary-button" onClick={openCapture}>
                    ＋ Create your first item
                  </button>
                )}
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span>
              <span className="footer-sparkle">✳</span>
              Made for your mind.
            </span>

            <span>
              PATCHWORK <span className="footer-version">EARLY ACCESS</span>
            </span>
          </footer>
        </section>
      </main>

      {showCapture && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCapture(false);
            }
          }}
        >
          <section
            className="capture-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-heading"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">QUICK CAPTURE</span>
                <h2 id="capture-heading">Get it out of your head.</h2>
                <p>Save it now. Organize it whenever you're ready.</p>
              </div>

              <button
                className="modal-close"
                aria-label="Close"
                onClick={() => setShowCapture(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={addItem}>
              <label className="form-label" htmlFor="item-title">
                What do you want to remember?
              </label>

              <input
                id="item-title"
                className="form-input"
                autoFocus
                required
                placeholder="Give it a name..."
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />

              <label className="form-label" htmlFor="item-description">
                Details or URL <span>(optional)</span>
              </label>

              <textarea
                id="item-description"
                className="form-input form-textarea"
                placeholder="Add a description, link, or thought..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />

              <label className="form-label" htmlFor="item-type">
                Save as
              </label>

              <select
                id="item-type"
                className="form-input"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as ItemType)
                }
              >
                <option value="Task">Task</option>
                <option value="Note">Note</option>
                <option value="Link">Link</option>
              </select>

              {type === "Task" && (
                <>
                  <label className="form-label" htmlFor="item-priority">
                    Priority
                  </label>

                  <select
                    id="item-priority"
                    className="form-input"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as Priority)
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>

                  <label className="form-label" htmlFor="item-due-date">
                    Due date <span>(optional)</span>
                  </label>

                  <input
                    id="item-due-date"
                    className="form-input"
                    type="date"
                    min={getLocalDate()}
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCapture(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  Save to workspace →
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App; 