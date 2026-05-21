import { test, expect } from '@playwright/test';

const demoPauseMs = 1200;

test.describe('BikeBooking workflows', () => {
  test.beforeEach(async ({ page }) => {
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
              bike_name: 'Vélo test',
              bike_code: 'E2E-BIKE-1',
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
              user_name: 'Playwright User',
              user_email: 'playwright@example.test',
              role_name: 'Utilisateur',
              is_admin: false,
            };
          }
          export async function fetchBikes() { return bikes; }
          export async function createBike() { return {}; }
          export async function updateBike() { return {}; }
          export async function deleteBike() { return {}; }
          export async function fetchUsers() { return [{ user_id: 1, user_name: 'Playwright User' }]; }
          export async function fetchReservations() { return reservations; }
          export async function fetchReservation(id) { return reservations.find((item) => item.reservation_id === Number(id)); }
          export async function createReservation(data) {
            const reservation = {
              reservation_id: 1,
              reservation_code: 'E2E-001',
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
            return { total_reservations: reservations.length, total_km: 0, returned_reservations: returns.length, unique_bikes: 1, favorite_bike: 'Vélo test', active_reservations: reservations.length };
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

  test('connects a Microsoft user and opens the reservation page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/BikeFlow/);
    await expect(page.getByText('BikeFlow').first()).toBeVisible();
    await expect(page.getByText('Playwright User - Utilisateur')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Gestion v.los entreprise/i })).toBeVisible();
  });

  test('reserves a bike and then cancels the reservation', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Vélo test' })).toBeVisible();
    await page.waitForTimeout(demoPauseMs);

    await page.getByRole('button', { name: 'Réserver' }).click();

    await expect(page.getByRole('heading', { name: /Réserver Vélo test/i })).toBeVisible();
    await page.waitForTimeout(demoPauseMs);

    await page.getByLabel('Début').selectOption('09:00');
    await page.getByLabel('Retour').selectOption('10:00');
    await expect(page.getByText(/de 09:00 à 10:00/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réserver maintenant' })).toBeDisabled();
    await page.getByRole('checkbox', { name: /J'ai lu et j'accepte/i }).check();
    await page.waitForTimeout(demoPauseMs);

    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    await expect(page.locator('code', { hasText: 'E2E-001' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mes prochaines réservations' })).toBeVisible();
    await page.waitForTimeout(demoPauseMs);

    await page.getByRole('button', { name: 'Annuler' }).click();

    await expect(page.locator('code', { hasText: 'E2E-001' })).toHaveCount(0);
    await expect(page.getByText('Aucune réservation pour ce créneau.')).toBeVisible();
  });

  test('reserves a bike and submits a return report', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Réserver' }).click();
    await page.getByLabel('Début').selectOption('09:00');
    await page.getByLabel('Retour').selectOption('10:00');
    await page.getByRole('checkbox', { name: /J'ai lu et j'accepte/i }).check();
    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    await expect(page.locator('code', { hasText: 'E2E-001' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Retour' }).click();

    await expect(page.getByRole('heading', { name: "Retour d'état" })).toBeVisible();
    await expect(page.getByText('Réservation E2E-001')).toBeVisible();
    await page.getByLabel('Kilométrage approximatif').fill('12');
    await page.getByLabel('Description').fill('Retour E2E sans anomalie');
    await page.getByRole('button', { name: 'Envoyer le retour' }).click();

    await expect(page.getByRole('heading', { name: "Retour d'état" })).toBeHidden();
    await expect(page.locator('code', { hasText: 'E2E-001' })).toHaveCount(0);
    await expect(page.getByText('Aucune réservation pour ce créneau.')).toBeVisible();
  });
});
