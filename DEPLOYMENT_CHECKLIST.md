# Deployment checklist

## Before public launch

- [ ] Create Supabase project
- [ ] Copy DATABASE_URL
- [ ] Create Render/Railway backend service
- [ ] Set environment variables
- [ ] Run migrations
- [ ] Run competition seed
- [ ] Verify /health endpoint
- [ ] Verify /api/competitions endpoint
- [ ] Connect Netlify frontend to backend URL
- [ ] Test sign-up
- [ ] Test sign-in
- [ ] Test joining competitions
- [ ] Test predictions
- [ ] Test score prediction validation
- [ ] Test quota unavailable message
- [ ] Enable database backups
- [ ] Never reset production database after launch
