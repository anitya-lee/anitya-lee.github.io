# anitya-lee.github.io

Personal site of **Yuri Lee** — AI Product Manager · researcher · ex-founder.

🌐 **Live**: [https://anitya-lee.github.io](https://anitya-lee.github.io)

---

## Stack

- **Jekyll** (GitHub Pages built-in, no Actions needed)
- **HTML + CSS** (custom, no framework)
- **Vanilla JS** (typing animation only)
- Hosted on **GitHub Pages**

---

## Writing a new essay

1. Create a markdown file in `_posts/` with date-prefix naming:
   ```
   _posts/2026-06-15-on-observing.md
   ```
2. Add frontmatter at top:
   ```markdown
   ---
   title: On observing what nobody else does
   date: 2026-06-15
   slug: on-observing
   description: A short one-liner that shows in OG previews.
   ---

   본문은 마크다운으로 작성. 헤딩, 리스트, 링크 다 됨.
   ```
3. Commit & push:
   ```bash
   git add _posts/2026-06-15-on-observing.md
   git commit -m "essay: on observing"
   git push
   ```
4. 1-2분 후 라이브: `https://anitya-lee.github.io/essays/on-observing/`

---

## Local preview (선택)

GitHub Pages가 자동으로 빌드하지만, 로컬에서 미리 확인하려면:

```bash
# Install Ruby + Bundler (한 번만)
brew install ruby
gem install bundler

# Install Jekyll + plugins
bundle install

# Run local server
bundle exec jekyll serve
# → http://localhost:4000
```

---

## File structure

```
.
├── _config.yml              # 사이트 설정
├── _layouts/
│   ├── default.html         # 모든 페이지 기본 shell
│   └── essay.html           # essay 페이지 wrapper
├── _includes/
│   ├── head.html            # <head> 메타·폰트
│   ├── nav.html             # 상단 nav
│   └── footer.html          # 푸터 + Contact
├── _posts/                  # ← essay markdown 여기에
│   └── YYYY-MM-DD-slug.md
├── assets/
│   ├── css/main.css         # 전체 CSS
│   ├── js/hero.js           # hero 타이핑 애니메이션
│   └── main.mov             # hero 영상
├── essays/index.html        # essay 아카이브
├── builds/index.html        # 프로젝트 페이지 (placeholder)
├── index.html               # 홈 (Hero + About)
├── 404.html                 # 커스텀 404
├── Gemfile                  # 로컬 dev용
└── tm-my-image-model/       # 기존 콘텐츠 (보존)
```

---

## To-do

- [ ] `assets/main.mov` → `assets/main.mp4` 로 변환 (브라우저 호환성 ↑, 크기 ↓)
  ```bash
  ffmpeg -i assets/main.mov -c:v libx264 -crf 23 -movflags +faststart -an assets/main.mp4
  ```
- [ ] favicon 실제 이미지로 교체
- [ ] OG 미리보기 이미지 (`assets/og-image.png` 1200×630)
- [ ] 첫 essay 본격 작성
- [ ] Builds 페이지 케이스 채우기
- [ ] About 섹션 visual collage 업그레이드 (현재 텍스트만)

---

## License

© Yuri Lee. All content reserved.
