import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { PublicIcon } from '../../Icons';
import { PlaceCard } from '.';

type CardProps = Parameters<typeof PlaceCard>[0];

function renderCard(props: Partial<CardProps> = {}) {
  const onViewScenes = vi.fn();
  render(
    <MemoryRouter>
      <ThemeProvider theme={dark}>
        <PlaceCard
          name="Land Name"
          place={{ kind: 'parcel', x: 96, y: 15 }}
          status="published"
          thumbnail="thumb.png"
          scenesCount={1}
          menuOptions={[{ text: 'Jump In', handler: () => {} }]}
          onViewScenes={onViewScenes}
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { onViewScenes };
}

describe('PlaceCard', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when the LAND is a published parcel', () => {
    it('should be an article named by the LAND, showing coordinates and scenes', () => {
      renderCard();

      const card = screen.getByRole('article', { name: 'Land Name' });
      expect(card.textContent).toContain('96,15');
      expect(card.textContent).toContain('1 Scene');
    });

    it('should name its menu after the LAND', () => {
      renderCard();

      expect(screen.getByRole('button', { name: 'Options for Land Name' })).toBeTruthy();
    });
  });

  describe('when the LAND is an estate', () => {
    it('should count its LANDs where a parcel shows coordinates', () => {
      renderCard({ place: { kind: 'estate', size: 6, base: { x: 0, y: 0 } }, scenesCount: 2 });

      const card = screen.getByRole('article');
      expect(card.textContent).toContain('6 LANDs');
      expect(card.textContent).toContain('2 Scenes');
    });
  });

  describe('when the account has a tagged role', () => {
    it('should show the tag after the place', () => {
      renderCard({ role: 'tenant' });

      expect(screen.getByRole('article').textContent).toContain('96,15Tenant');
    });
  });

  describe('when nothing is published on the LAND', () => {
    it('should say so and offer the Scenes page', () => {
      const { onViewScenes } = renderCard({ status: 'unpublished' });

      fireEvent.click(screen.getByRole('button', { name: 'View Scenes' }));

      expect(screen.getByText('No Scene Published')).toBeTruthy();
      expect(onViewScenes).toHaveBeenCalled();
    });
  });

  describe('when the card links to a detail page', () => {
    it('should make the name its one link', () => {
      renderCard({ to: '/manage/land/96%2C15/details' });

      expect(screen.getByRole('link', { name: 'Land Name' }).getAttribute('href')).toBe(
        '/manage/land/96%2C15/details',
      );
    });
  });

  describe('when the place is a published World', () => {
    const renderWorld = (props: Partial<CardProps> = {}) =>
      renderCard({
        name: 'Plaza',
        place: { kind: 'world', domain: 'plaza.dcl.eth' },
        scenesCount: 2,
        to: '/manage/world/plaza.dcl.eth/details',
        ...props,
      });

    it('should show the globe and the full domain, then the scenes', () => {
      renderWorld();

      const card = screen.getByRole('article', { name: 'Plaza' });
      expect(card.textContent).toContain('plaza.dcl.eth');
      expect(card.textContent).toContain('2 Scenes');
      const globe = render(<PublicIcon />)
        .container.querySelector('path')
        ?.getAttribute('d');
      expect(card.querySelector('svg path')?.getAttribute('d')).toBe(globe);
    });

    it('should tag a collaborator', () => {
      renderWorld({ role: 'collaborator' });

      expect(screen.getByRole('article').textContent).toContain('plaza.dcl.ethCollaborator');
    });

    it('should link its name to the World detail page and name its menu after the domain', () => {
      renderWorld();

      expect(screen.getByRole('link', { name: 'Plaza' }).getAttribute('href')).toBe(
        '/manage/world/plaza.dcl.eth/details',
      );
      expect(screen.getByRole('button', { name: 'Options for plaza.dcl.eth' })).toBeTruthy();
    });

    it('should not link when it has nowhere to go', () => {
      renderWorld({ to: undefined });

      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.getByRole('article', { name: 'Plaza' })).toBeTruthy();
    });
  });

  describe('when nothing is published on the World', () => {
    it('should hide the name and be named by its domain', () => {
      renderCard({
        name: 'plaza.dcl.eth',
        place: { kind: 'world', domain: 'plaza.dcl.eth' },
        status: 'unpublished',
        scenesCount: 0,
      });

      const card = screen.getByRole('article', { name: 'plaza.dcl.eth' });
      expect(card.querySelector('h2')?.getAttribute('aria-hidden')).toBe('true');
      expect(screen.getByText('No Scene Published')).toBeTruthy();
    });

    it('should make the domain line its one link to the detail page, keeping VIEW SCENES', () => {
      const { onViewScenes } = renderCard({
        name: 'plaza.dcl.eth',
        place: { kind: 'world', domain: 'plaza.dcl.eth' },
        status: 'unpublished',
        scenesCount: 0,
        to: '/manage/world/plaza.dcl.eth/details',
      });

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(1);
      expect(links[0].textContent).toBe('plaza.dcl.eth');
      expect(links[0].getAttribute('href')).toBe('/manage/world/plaza.dcl.eth/details');
      expect(screen.getByRole('article', { name: 'plaza.dcl.eth' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'View Scenes' }));
      expect(onViewScenes).toHaveBeenCalled();
    });

    it('should not link the domain when it has nowhere to go', () => {
      renderCard({
        name: 'plaza.dcl.eth',
        place: { kind: 'world', domain: 'plaza.dcl.eth' },
        status: 'unpublished',
        scenesCount: 0,
      });

      expect(screen.queryByRole('link')).toBeNull();
    });
  });

  describe('when nothing is published on the LAND', () => {
    it('should keep its name as its one link', () => {
      renderCard({ status: 'unpublished', scenesCount: 0, to: '/manage/land/96%2C15/details' });

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(1);
      expect(links[0].textContent).toBe('Land Name');
    });
  });
});
