const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());

/* 🔥 PENTING: PINDAHKAN STATIC KE BAWAH NANTI */

/* ================= DATABASE ================= */

const db = new sqlite3.Database('database.db');

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT,
  sentiment TEXT
)
`);

/* ================= ROUTE AWAL ================= */
/* 🔥 INI KUNCINYA */
app.get('/', (req,res)=>{
  res.sendFile(__dirname + '/public/login.html');
});

/* ================= STATIC ================= */
/* 🔥 TARUH DI SINI (SETELAH ROUTE /) */
app.use(express.static('public'));

/* ================= LOGIN ================= */
app.post('/login',(req,res)=>{
  const {username,password} = req.body;

  db.get(
    'SELECT * FROM users WHERE username=? AND password=?',
    [username,password],
    (err,row)=>{
      if(row){
        res.json({success:true});
      } else {
        res.json({success:false, message:'Username / Password salah!'});
      }
    }
  );
});

/* ================= REGISTER ================= */
app.post('/register',(req,res)=>{
  const {username,password} = req.body;

  db.run(
    'INSERT INTO users (username,password) VALUES (?,?)',
    [username,password],
    function(err){
      if(err){
        return res.json({success:false, message:'Username sudah digunakan!'});
      }
      res.json({success:true});
    }
  );
});

/* ================= SENTIMEN ================= */
function analyze(text){
  text = text.toLowerCase();

  const pos=['bagus','baik','mantap','keren','puas','cepat','murah'];
  const neg=['jelek','buruk','rusak','lambat','mahal','parah'];

  let score=0;

  pos.forEach(w=>{ if(text.includes(w)) score++; });
  neg.forEach(w=>{ if(text.includes(w)) score--; });

  return score>=0 ? 'Positif':'Negatif';
}

/* ================= API ================= */

app.post('/analyze',(req,res)=>{
  let text=req.body.text;
  let sentiment=analyze(text);

  db.run('INSERT INTO reviews (text,sentiment) VALUES (?,?)',[text,sentiment]);

  res.json({sentiment});
});

app.get('/data',(req,res)=>{
  db.all('SELECT * FROM reviews',[],(err,rows)=>{
    res.json(rows);
  });
});

app.delete('/reset',(req,res)=>{
  db.run('DELETE FROM reviews');
  res.json({message:'reset'});
});

/* ================= TOP WORD ================= */

function preprocess(text){
  text = text.toLowerCase();
  text = text.replace(/[^a-zA-Z0-9\s]/g,'');

  let stopwords=['yang','dan','di','ke','dari','ini','itu','saya','aku'];

  return text.split(/\s+/).filter(w=>w && !stopwords.includes(w));
}

app.get('/top-words',(req,res)=>{
  db.all('SELECT text FROM reviews',[],(err,rows)=>{

    let freq={};

    rows.forEach(r=>{
      let words=preprocess(r.text);

      words.forEach(w=>{
        freq[w]=(freq[w]||0)+1;
      });
    });

    let sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10);

    res.json(sorted);
  });
});

/* ================= TF-IDF ================= */

app.get('/tfidf',(req,res)=>{
  db.all('SELECT text FROM reviews',[],(err,rows)=>{

    let docs=rows.map(r=>preprocess(r.text));
    let N=docs.length;

    let df={}, tfidf={};

    docs.forEach(doc=>{
      [...new Set(doc)].forEach(w=>{
        df[w]=(df[w]||0)+1;
      });
    });

    docs.forEach(doc=>{
      let count={};

      doc.forEach(w=>{
        count[w]=(count[w]||0)+1;
      });

      for(let w in count){
        let tf=count[w]/doc.length;
        let idf=Math.log(N/(df[w]||1));

        tfidf[w]=(tfidf[w]||0)+(tf*idf);
      }
    });

    let result=Object.entries(tfidf)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(w=>[w[0],w[1].toFixed(3)]);

    res.json(result);
  });
});

/* ================= RUN ================= */

app.listen(3000,()=>{
  console.log('http://localhost:3000');
});