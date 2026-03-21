<p align="center">
  <img src="https://img.shields.io/badge/Portfolio-CV%20Interactif-0d2e60?style=for-the-badge&logo=github&logoColor=white" alt="Portfolio badge" />
  <img src="https://img.shields.io/badge/GitHub%20Pages-En%20ligne-1f8f56?style=for-the-badge&logo=githubpages&logoColor=white" alt="GitHub Pages badge" />
  <img src="https://img.shields.io/badge/HTML-5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML badge" />
  <img src="https://img.shields.io/badge/CSS-3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS badge" />
  <img src="https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111" alt="JavaScript badge" />
</p>

<h1 align="center">curriculum-vitae</h1>

<p align="center">
  <strong>Portfolio / CV interactif</strong><br>
</p>

<p align="center">
  <a href="https://fkmraxxx.github.io/curriculum-vitae/"><strong>Voir le site</strong></a>
  ·
  <a href="https://fkmraxxx.github.io/curriculum-vitae/game.html"><strong>Bibliothèque de jeux</strong></a>
  ·
  <a href="https://fkmraxxx.github.io/curriculum-vitae/admin/"><strong>Admin CMS</strong></a>
</p>

---

## Aperçu

Ce dépôt contient mon **site portfolio / CV en HTML, CSS et JavaScript**, publié via **GitHub Pages**.

Le projet regroupe :

- un **CV interactif** avec animations d’introduction
- plusieurs **pages projets** détaillées
- une **bibliothèque de jeux** dynamique
- une **interface d’administration** pour ajouter/modifier les jeux
- un **proxy OAuth Cloudflare Worker** pour sécuriser l’authentification GitHub du CMS

L’objectif est de proposer un portfolio **visuel, moderne, autonome et 100 % statique côté site public**, tout en conservant une gestion de contenu simple pour la partie jeux.

---

## Fonctionnalités

### CV interactif
- écran d’introduction animé
- ouverture du CV au clic sur la photo
- effets visuels personnalisés
- version pensée pour l’affichage web et l’impression

### Pages projets
- **Projet Licences**
- **Projet Hyper-V**
- **Projet CAN**
- **Camping MQTT**
- **IR Game**
- **Skybot**
- **Bot Discord Docker**

Chaque page présente :
- le contexte
- l’architecture
- les technologies utilisées
- les objectifs
- les résultats
- des captures ou illustrations

### Bibliothèque de jeux
- page dédiée `game.html`
- affichage dynamique depuis `data/games.json`
- filtres par statut
- tri par note / année / titre
- regroupement par franchise
- mise en avant visuelle d’un jeu sélectionné
- covers et images hébergées dans le dépôt

### Administration de contenu
- accès via `admin/`
- gestion des jeux depuis **Decap CMS**
- stockage dans GitHub
- ajout d’images directement dans le repo
- mise à jour sans base de données

---

## Stack utilisée

<p>
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2F%20CSS%20%2F%20JS-24160f?style=flat-square" alt="Frontend" />
  <img src="https://img.shields.io/badge/Hosting-GitHub%20Pages-222222?style=flat-square&logo=github" alt="GitHub Pages" />
  <img src="https://img.shields.io/badge/CMS-Decap%20CMS-7f3f98?style=flat-square" alt="Decap CMS" />
  <img src="https://img.shields.io/badge/Auth-GitHub%20OAuth-181717?style=flat-square&logo=github" alt="GitHub OAuth" />
  <img src="https://img.shields.io/badge/Proxy-Cloudflare%20Worker-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Worker" />
  <img src="https://img.shields.io/badge/Data-JSON-a35f3f?style=flat-square" alt="JSON" />
</p>

### Front
- HTML5
- CSS3
- JavaScript vanilla

### Déploiement
- GitHub Pages

### Gestion de contenu
- Decap CMS
- GitHub backend

### Authentification CMS
- GitHub OAuth App
- Cloudflare Worker (`workers.dev`)

### Données
- `data/games.json`
- images locales dans `static/images/games`

---
