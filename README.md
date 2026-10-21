# Wage Calculator

A mobile-first, offline-capable hourly wage calculator. Set an hourly rate and start/end times to calculate pay, with configurable time intervals, currency, clock format, and theme.

## Features

- Calculate wages from an hourly rate and start/end times, including overnight shifts of up to 12 hours.
- Set either time to the current time, rounded to the configured interval, or choose a time manually.
- Use a separately persisted manual hourly rate or create and select saved employees.
- Add, edit, and delete employees with individual hourly wages, optional per-shift travel allowances, and positive or negative balances.
- Include a selected employee's balance and travel allowance in the amount owed, with a clear breakdown of shift wage + balance + travel = total.
- Add the current shift wage and travel allowance to an employee's balance and clear the shift times in one action.
- Manually adjust employee balances using the same currency precision as displayed wages, with a ± control for entering overpayments on mobile keypads.
- Choose the currency, 12- or 24-hour clock, time interval, and light, dark, or device theme.
- Keep settings, employees, balances, and in-progress times locally on the device.
- Install and use the app offline as a mobile-friendly PWA.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm test`, `npm run lint`, and `npm run build` before shipping.

## Deployment

Import the repository into Vercel and use the detected Next.js defaults. The application requires no environment variables or external services.
