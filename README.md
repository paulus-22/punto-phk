# 🎮 PUNTO AI – Strategy Board Game

**PUNTO AI** adalah implementasi digital dari permainan papan *Punto* dengan fokus pada **kecerdasan buatan (AI)** dan **eksperimen strategi**.  
Game ini berjalan **sepenuhnya di browser** (HTML, CSS, JavaScript) dan mendukung **Human vs AI**, **AI vs AI**, serta **Tournament Mode**.

Project ini dikembangkan sebagai **platform eksperimen AI**, bukan sekadar game hiburan.

## 🧠 Fitur Utama

### 🎲 Gameplay
- Papan **9×9**
- **2–4 pemain**
- Kartu bernilai **1–9** (masing-masing muncul 2× per warna)
- Penempatan harus **bertetangga (8 arah)**
- **Stacking** diperbolehkan jika kartu lebih besar
- Menang dengan **4 kartu berwarna sama berurutan**
- **Tie-break** berdasarkan jumlah & nilai deret

---

### 🤖 AI System
Game ini memiliki **dua tipe AI**:

#### 1️⃣ AI Smart (Heuristic + Minimax)
- Rule-based heuristic
- Threat detection & blocking
- Smart stacking
- Minimax + Alpha-Beta Pruning
- Iterative Deepening (Level 3)

#### 2️⃣ AI Paranoid (Paranoid Minimax)
- Menganggap semua lawan sebagai koalisi
- Cocok untuk game multi-player
- Paranoid Minimax + Alpha-Beta
- Lebih defensif dan stabil

---

### 🎚️ AI Difficulty Level
Setiap AI memiliki **3 level**:

| Level | Karakteristik |
|------|---------------|
| Level 1 | Cepat, greedy, dangkal |
| Level 2 | Minimax depth rendah |
| Level 3 | Pencarian lebih dalam (lebih kuat, lebih lama) |

---

### 🧪 Mode Permainan

#### 👤 Human + AI
- 1 pemain manusia
- Hingga 3 AI lawan

#### 🤖 AI vs AI
- Hingga **4 AI sekaligus**
- Cocok untuk observasi dan eksperimen

#### 🏆 Tournament Mode
- Auto-run **N game** (20 / 30 / 50 / dst)
- Statistik kemenangan AI
- Digunakan untuk membandingkan performa AI

---

## ⏯️ Kontrol & Debugging

- ⏱️ **Auto-play speed** (0.2s / 0.5s / 1s)
- ⏸️ Pause
- ▶ Step (1 langkah AI)
- 🧠 **AI Reasoning Overlay**  
  Menampilkan alasan AI memilih suatu langkah
- 🃏 **AI Card Visibility** (AI vs AI)
- 📊 Match Summary (move count & think time)
- ⬇ **Export Match JSON**

---

## 📊 Statistik & Evaluasi

Setiap game mencatat:
- Total jumlah move
- Rata-rata waktu berpikir AI
- Jumlah turn per AI
- Statistik kemenangan (Tournament Mode)

Data dapat diekspor sebagai **JSON** untuk analisis lanjutan.

---

## 🛠️ Teknologi yang Digunakan

- **HTML5**
- **CSS3 (Pixel / Retro Style)**
- **Vanilla JavaScript**
- Tidak menggunakan framework atau backend
- Seluruh AI berjalan **client-side**

---

## 📦 Struktur Proyek

```text
.
├── index.html      # UI utama
├── style.css       # Styling & layout
├── script.js       # Game logic & UI flow
├── ai1.js          # AI logic (Smart & Paranoid)
├── vercel.json     # (opsional) config deployment
└── README.md