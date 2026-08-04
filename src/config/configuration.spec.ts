import { parseCorsOrigins } from './configuration';

describe('parseCorsOrigins', () => {
  it('strips quotes and trailing slashes', () => {
    expect(
      parseCorsOrigins(
        '"https://solar-app-frontend-theta.vercel.app/", http://localhost:4200/',
      ),
    ).toEqual([
      'https://solar-app-frontend-theta.vercel.app',
      'http://localhost:4200',
    ]);
  });

  it('supports newline-separated Vercel env values', () => {
    expect(
      parseCorsOrigins(
        'http://localhost:4200\nhttps://solar-app-frontend-theta.vercel.app',
      ),
    ).toEqual([
      'http://localhost:4200',
      'https://solar-app-frontend-theta.vercel.app',
    ]);
  });
});
