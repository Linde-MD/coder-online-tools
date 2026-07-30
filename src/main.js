import { createApp } from 'vue';
import './styles/ui-foundation.css';
import './styles/tailwind.css';
import './styles/common.css';
import './styles/style.css';
import App from './App.vue';
import router from '@/app/router';

document.body.classList.add('theme-warm-editorial');

const app = createApp(App);
app.use(router);
app.mount('#app');
