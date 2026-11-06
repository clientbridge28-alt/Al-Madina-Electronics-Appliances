import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, AlertCircle, 
  Clock, CheckCircle2, Calendar, User, Tag, 
  Trash2, Edit3, ArrowRight, Sparkles, Check,
  Flame, ChevronRight, MoreVertical, Sliders
} from 'lucide-react';
import { 
  getTasks, saveTask, updateTaskStatus, deleteTask, 
  getEmployees, getActiveUser 
} from '../../services/storage';
import { StaffTask, TaskPriority, TaskStatus } from '../../types/erp';
import { Modal } from '../common/Modal';

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<StaffTask[]>(getTasks());
  const employees = getEmployees();
  const currentUser = getActiveUser();

  // Filters
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState(employees[0]?.name || 'Showroom Staff');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [category, setCategory] = useState<StaffTask['category']>('Showroom Floor');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Categories list
  const categories: StaffTask['category'][] = [
    'Showroom Floor',
    'Stock & Warehouse',
    'Recovery & Calls',
    'Accounts & Banking',
    'Customer Support',
    'General'
  ];

  // Refresh tasks from storage
  const reloadTasks = () => setTasks(getTasks());

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchStatus = statusFilter === 'All' || t.status === statusFilter;
      const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
      const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
      const matchAssignee = assigneeFilter === 'All' || t.assignedTo === assigneeFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        t.title.toLowerCase().includes(q) || 
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.assignedTo.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);
      return matchStatus && matchPriority && matchCategory && matchAssignee && matchSearch;
    });
  }, [tasks, statusFilter, priorityFilter, categoryFilter, assigneeFilter, searchQuery]);

  // Statistics
  const pendingCount = useMemo(() => tasks.filter(t => t.status === 'Pending').length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter(t => t.status === 'In Progress').length, [tasks]);
  const completedCount = useMemo(() => tasks.filter(t => t.status === 'Completed').length, [tasks]);
  const urgentCount = useMemo(() => tasks.filter(t => t.priority === 'Urgent' && t.status !== 'Completed').length, [tasks]);

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: StaffTask = {
      id: editingTask ? editingTask.id : `TSK-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      assignedBy: currentUser.name || 'Showroom Admin',
      priority,
      status: editingTask ? editingTask.status : 'Pending',
      category,
      dueDate,
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString().split('T')[0],
      progressPercent: editingTask ? editingTask.progressPercent : 0,
      notes: notes.trim()
    };

    saveTask(newTask);
    reloadTasks();
    setShowAddModal(false);
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setNotes('');
  };

  const handleOpenEdit = (task: StaffTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setAssignedTo(task.assignedTo);
    setPriority(task.priority);
    setCategory(task.category);
    setDueDate(task.dueDate);
    setNotes(task.notes || '');
    setShowAddModal(true);
  };

  const handleToggleComplete = (task: StaffTask) => {
    const nextStatus: TaskStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    updateTaskStatus(task.id, nextStatus);
    reloadTasks();
  };

  const handleProgressChange = (taskId: string, percent: number) => {
    const nextStatus: TaskStatus = percent === 100 ? 'Completed' : percent > 0 ? 'In Progress' : 'Pending';
    updateTaskStatus(taskId, nextStatus, percent);
    reloadTasks();
  };

  const handleDelete = (taskId: string) => {
    if (window.confirm('Delete this task from staff to-do list?')) {
      deleteTask(taskId);
      reloadTasks();
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      case 'Medium':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
      case 'Low':
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
      case 'In Progress':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold';
      case 'Pending':
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
      case 'Deferred':
        return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Staff Tasks & Daily To-Do Hub
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Operations Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage floor responsibilities, customer callbacks, stock intake, recoveries & staff progress
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            setTitle('');
            setDescription('');
            setNotes('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Assign New Task</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Action</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{pendingCount}</p>
          <p className="text-[11px] text-slate-400">Awaiting staff attention</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sliders className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-700 font-mono">{inProgressCount}</p>
          <p className="text-[11px] text-indigo-600">Floor operations ongoing</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Tasks</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono">{completedCount}</p>
          <p className="text-[11px] text-emerald-600 font-medium">Successfully executed</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Urgent Priorities</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-700 font-mono">{urgentCount}</p>
          <p className="text-[11px] text-rose-600">Immediate recovery / audits</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            {(['All', 'Pending', 'In Progress', 'Completed', 'Deferred'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                  statusFilter === tab 
                    ? 'bg-blue-600 text-white shadow-2xs font-bold' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions, staff..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Secondary Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filters:
          </span>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
          >
            <option value="All">All Priorities</option>
            <option value="Urgent">Urgent Only</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
          >
            <option value="All">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
          >
            <option value="All">All Staff Members</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.name}>{emp.name} ({emp.designation})</option>
            ))}
          </select>

          {(priorityFilter !== 'All' || categoryFilter !== 'All' || assigneeFilter !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setPriorityFilter('All');
                setCategoryFilter('All');
                setAssigneeFilter('All');
                setSearchQuery('');
              }}
              className="text-[11px] text-blue-600 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Task Cards List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">No tasks matching current filter</p>
              <p className="text-xs text-slate-400 mt-1">Assign daily tasks to showroom staff to streamline operations.</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Task</span>
            </button>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isDone = task.status === 'Completed';

            return (
              <div 
                key={task.id}
                className={`rounded-2xl border p-4 sm:p-5 transition shadow-2xs bg-white ${
                  isDone ? 'border-slate-200 bg-slate-50/50 opacity-80' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Checkbox + Title + Description */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                        isDone 
                          ? 'border-emerald-600 bg-emerald-600 text-white' 
                          : 'border-slate-300 hover:border-blue-600 bg-white'
                      }`}
                      title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                    >
                      {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{task.id}</span>
                        <h3 className={`text-sm font-bold text-slate-900 ${isDone ? 'line-through text-slate-500' : ''}`}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${getPriorityBadge(task.priority)}`}>
                          {task.priority} Priority
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${getStatusBadge(task.status)}`}>
                          {task.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-medium">
                          {task.category}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {task.notes && (
                        <p className="text-[11px] text-blue-700 bg-blue-50/60 border border-blue-100 rounded-lg p-2 mt-1">
                          <strong>Staff Note:</strong> {task.notes}
                        </p>
                      )}

                      {/* Meta footer */}
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          <strong className="text-slate-700">Assigned:</strong> {task.assignedTo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          <strong className="text-slate-700">Due:</strong> {task.dueDate}
                        </span>
                        {task.completedAt && (
                          <span className="text-emerald-700 font-medium">
                            ✓ Done at {task.completedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Progress Control & Actions */}
                  <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(task)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                        title="Edit Task"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Progress tracker */}
                    <div className="w-36 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-mono text-slate-800">{task.progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div 
                          style={{ width: `${task.progressPercent}%` }}
                          className={`h-full transition-all duration-300 ${
                            task.progressPercent === 100 
                              ? 'bg-emerald-500' 
                              : task.progressPercent > 50 
                              ? 'bg-blue-600' 
                              : 'bg-amber-400'
                          }`}
                        />
                      </div>
                      {/* Quick progress steps */}
                      <div className="flex items-center justify-between pt-0.5">
                        {[0, 25, 50, 75, 100].map(pct => (
                          <button
                            key={pct}
                            onClick={() => handleProgressChange(task.id, pct)}
                            className={`text-[9px] font-mono px-1 rounded transition ${
                              task.progressPercent === pct 
                                ? 'bg-slate-800 text-white font-bold' 
                                : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Task Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingTask(null); }}
        title={editingTask ? 'Edit Staff Task' : 'Assign New Daily Staff Task'}
        subtitle="Organize showroom duties, assign responsible floor staff and track completion"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Inspect display AC units, Call customer regarding due installment..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Detailed Description & Checklist</label>
            <textarea
              rows={3}
              placeholder="Provide step-by-step instructions or items to inspect..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assign Responsible Staff *</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} — {emp.designation}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Priority Level *</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold"
              >
                <option value="Urgent">🚨 Urgent (Immediate)</option>
                <option value="High">⚠️ High Priority</option>
                <option value="Medium">⚡ Medium Standard</option>
                <option value="Low">🌱 Low Routine</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Operational Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
              >
              </input>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Internal Reference / Staff Notes</label>
            <input
              type="text"
              placeholder="e.g. Inverter serial #, customer phone, locker key number..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setShowAddModal(false); setEditingTask(null); }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs active:scale-98 transition"
            >
              <Check className="h-4 w-4" />
              <span>{editingTask ? 'Update Task' : 'Assign Task'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
