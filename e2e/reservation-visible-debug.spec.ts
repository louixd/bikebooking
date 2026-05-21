import { test, expect } from '@playwright/test';

const pauseMs = 2500;
const timeOptions = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30',
];

async function pauseForViewer(page) {
  await page.waitForTimeout(pauseMs);
}

async function installRedCursor(page) {
  await page.addInitScript(() => {
    const createCursor = () => {
      if (document.getElementById('playwright-red-cursor')) return;

      const cursor = document.createElement('div');
      cursor.id = 'playwright-red-cursor';
      cursor.style.position = 'fixed';
      cursor.style.left = '24px';
      cursor.style.top = '24px';
      cursor.style.width = '28px';
      cursor.style.height = '28px';
      cursor.style.borderRadius = '999px';
      cursor.style.background = '#ff0000';
      cursor.style.border = '4px solid #ffffff';
      cursor.style.boxShadow = '0 0 0 4px rgba(255, 0, 0, 0.35), 0 8px 18px rgba(0, 0, 0, 0.35)';
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '2147483647';
      cursor.style.transition = 'left 120ms linear, top 120ms linear, transform 120ms ease';
      document.body.appendChild(cursor);

      (window as any).__movePlaywrightRedCursor = (x, y) => {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      };

      (window as any).__pressPlaywrightRedCursor = () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.72)';
      };

      (window as any).__releasePlaywrightRedCursor = () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createCursor);
    } else {
      createCursor();
    }
  });
}

function pickRandomSlot() {
  const startIndex = Math.floor(Math.random() * (timeOptions.length - 3));
  const durationSlots = 1 + Math.floor(Math.random() * 3);
  return {
    startTime: timeOptions[startIndex],
    endTime: timeOptions[startIndex + durationSlots],
  };
}

function pickRandomDate() {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * 7));
  return date.toISOString().split('T')[0];
}

async function moveRedCursorTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Impossible de placer le curseur rouge sur l’élément demandé.');
  await page.evaluate(({ x, y }) => {
    (window as any).__movePlaywrightRedCursor?.(x, y);
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

async function clickWithRedCursor(page, locator) {
  await moveRedCursorTo(page, locator);
  await page.evaluate(() => (window as any).__pressPlaywrightRedCursor?.());
  await locator.click();
  await page.evaluate(() => (window as any).__releasePlaywrightRedCursor?.());
  await pauseForViewer(page);
}

async function selectWithRedCursor(page, locator, value) {
  await moveRedCursorTo(page, locator);
  await locator.selectOption(value);
  await pauseForViewer(page);
}

async function fillWithRedCursor(page, locator, value) {
  await moveRedCursorTo(page, locator);
  await locator.fill(value);
  await pauseForViewer(page);
}

async function checkWithRedCursor(page, locator) {
  await moveRedCursorTo(page, locator);
  await locator.check();
  await pauseForViewer(page);
}

async function uncheckWithRedCursor(page, locator) {
  await moveRedCursorTo(page, locator);
  await locator.uncheck();
  await pauseForViewer(page);
}

test.describe('Démonstration visible - réservation vélo', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await installRedCursor(page);

    await page.route('**/src/api/entraAuth.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          export async function initializeEntraSession() { return 'playwright-id-token'; }
          export async function signInWithEntra() { return null; }
          export async function signOutWithEntra() { return null; }
        `,
      });
    });

    await page.route('**/src/api/bikeflowApi.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          const today = new Date().toISOString().split('T')[0];
          const bikes = [
            {
              bike_id: 1,
              bike_name: 'Vélo test visible',
              bike_code: 'VISIBLE-001',
              bike_description: 'cadre en trapèze',
              bike_size: 'M',
              is_available: true,
            },
          ];
          let reservations = [];
          let returns = [];

          export function setAuthToken() {}
          export async function loginEntra() {
            return {
              user_id: 1,
              user_name: 'Utilisateur Démo',
              user_email: 'demo@example.test',
              role_name: 'Utilisateur',
              is_admin: false,
            };
          }
          export async function fetchBikes() { return bikes; }
          export async function createBike() { return {}; }
          export async function updateBike() { return {}; }
          export async function deleteBike() { return {}; }
          export async function fetchUsers() { return [{ user_id: 1, user_name: 'Utilisateur Démo' }]; }
          export async function fetchReservations() { return reservations; }
          export async function fetchReservation(id) { return reservations.find((item) => item.reservation_id === Number(id)); }
          export async function createReservation(data) {
            const reservation = {
              reservation_id: 1,
              reservation_code: 'VISIBLE-RES-001',
              bike_id: data.bike_id,
              user_id: data.user_id,
              user_name_free: data.user_name_free,
              reservation_date: data.reservation_date || today + 'T09:00:00',
              return_date: data.return_date || today + 'T10:00:00',
            };
            reservations = [reservation];
            return reservation;
          }
          export async function cancelReservation(id) {
            reservations = reservations.filter((item) => item.reservation_id !== Number(id));
            return {};
          }
          export async function fetchMyStats() {
            return {
              total_reservations: reservations.length,
              total_km: 0,
              returned_reservations: returns.length,
              unique_bikes: 1,
              favorite_bike: 'Vélo test visible',
              active_reservations: reservations.length,
            };
          }
          export async function fetchReparations() { return []; }
          export async function createReparation() { return {}; }
          export async function closeReparation() { return {}; }
          export async function fetchReturns() { return returns; }
          export async function fetchReturn(reservationId) { return returns.find((item) => item.reservation_id === Number(reservationId)) || null; }
          export async function createReturn() { return {}; }
          export async function createReturnWithPhotos(data) {
            returns = [{ return_id: 1, reservation_id: data.reservation_id, bike_id: data.bike_id, return_state: data.return_state, mileage: data.mileage }];
            return returns[0];
          }
        `,
      });
    });
  });

  test('réserver un vélo avec pauses visibles de 2 à 3 secondes', async ({ page }) => {
    const randomDate = pickRandomDate();
    const { startTime, endTime } = pickRandomSlot();

    await test.step('ouvrir le site', async () => {
      await page.goto('/');
      await expect(page.getByText('Utilisateur Démo - Utilisateur')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Vélo test visible' })).toBeVisible();
      await moveRedCursorTo(page, page.getByRole('heading', { name: 'Vélo test visible' }));
      await pauseForViewer(page);
    });

    await test.step('observer le bouton Réserver', async () => {
      await moveRedCursorTo(page, page.getByRole('button', { name: 'Réserver' }));
      await pauseForViewer(page);
    });

    await test.step('cliquer sur Réserver', async () => {
      await clickWithRedCursor(page, page.getByRole('button', { name: 'Réserver' }));
      await expect(page.getByRole('heading', { name: /Réserver Vélo test visible/i })).toBeVisible();
    });

    await test.step('choisir une date au hasard', async () => {
      await fillWithRedCursor(page, page.getByLabel('Date'), randomDate);
      await expect(page.getByLabel('Début')).toBeEnabled();
    });

    await test.step('choisir une heure de début au hasard', async () => {
      await selectWithRedCursor(page, page.getByLabel('Début'), startTime);
      await expect(page.getByText(new RegExp(`de ${startTime}`, 'i'))).toBeVisible();
    });

    await test.step('choisir une heure de retour au hasard', async () => {
      await selectWithRedCursor(page, page.getByLabel('Retour'), endTime);
      await expect(page.getByText(new RegExp(`de ${startTime} à ${endTime}`, 'i'))).toBeVisible();
    });

    await test.step('pointer le lien du règlement sans l’ouvrir', async () => {
      await moveRedCursorTo(page, page.getByRole('link', { name: /règlement d'utilisation des vélos/i }));
      await pauseForViewer(page);
    });

    await test.step('vérifier que le bouton est bloqué avant acceptation', async () => {
      await expect(page.getByRole('button', { name: 'Réserver maintenant' })).toBeDisabled();
      await moveRedCursorTo(page, page.getByRole('button', { name: 'Réserver maintenant' }));
      await pauseForViewer(page);
    });

    await test.step('cocher le règlement', async () => {
      await checkWithRedCursor(page, page.getByRole('checkbox', { name: /J'ai lu et j'accepte/i }));
      await expect(page.getByRole('button', { name: 'Réserver maintenant' })).toBeEnabled();
    });

    await test.step('décocher le règlement pour vérifier le blocage', async () => {
      await uncheckWithRedCursor(page, page.getByRole('checkbox', { name: /J'ai lu et j'accepte/i }));
      await expect(page.getByRole('button', { name: 'Réserver maintenant' })).toBeDisabled();
    });

    await test.step('recocher le règlement avant validation', async () => {
      await checkWithRedCursor(page, page.getByRole('checkbox', { name: /J'ai lu et j'accepte/i }));
      await expect(page.getByRole('button', { name: 'Réserver maintenant' })).toBeEnabled();
    });

    await test.step('confirmer la réservation', async () => {
      await clickWithRedCursor(page, page.getByRole('button', { name: 'Réserver maintenant' }));
      await expect(page.locator('code', { hasText: 'VISIBLE-RES-001' }).first()).toBeVisible();
    });
  });
});
