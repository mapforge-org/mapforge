require 'rails_helper'

describe 'Feature edit' do
  let(:map) { create(:map, name: 'Feature edit test') }
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit map.private_map_path
    expect_map_loaded
  end

  context 'with empty map' do
    it 'shows feature edit buttons' do
      expect(page).to have_css('.mapbox-gl-draw_line')
      expect(page).to have_css('.mapbox-gl-draw_polygon')
      expect(page).to have_css('.mapbox-gl-draw_point')
    end

    context 'when adding features' do
      it 'adding a point to the map' do
        find('.mapbox-gl-draw_point').click
        expect { click_coord('#maplibre-map', 50, 50) }.to change { Feature.point.count }.by(1)
      end

      it 'adding a line to the map' do
        find('.line-menu-btn').click
        find('.ctrl-line-menu .mapbox-gl-draw_line').click
        click_coord('#maplibre-map', 50, 50)
        click_coord('#maplibre-map', 70, 70)
        click_coord('#maplibre-map', 70, 70)

        # need to wait until feature is saved server side
        wait_for { Feature.line_string.count }.to eq(1)
      end

      it 'adding a polygon to the map' do
        find('.mapbox-gl-draw_polygon').click

        click_coord('#maplibre-map', 10, 10)
        click_coord('#maplibre-map', 10, 50)
        click_coord('#maplibre-map', 50, 50)
        click_coord('#maplibre-map', 50, 10)
        click_coord('#maplibre-map', 10, 10)

        expect(page).to have_text(/Added feature|Map view updated/)
        # need to wait until feature is saved server side
        wait_for { Feature.polygon.count }.to eq(1)
      end
    end
  end

  context 'with polygon on map' do
    let!(:polygon) { create(:feature, :polygon_middle, title: 'Poly Title') }
    let(:map) { create(:map, features: [ polygon ]) }

    context 'with selected polygon feature' do
      before do
        click_coord('#maplibre-map', 50, 50)
        expect(page).to have_css('#edit-button-edit')
      end

      it 'shows feature title + details' do
        expect(page).to have_text('Poly Title')
      end

      it 'adds feature id to url' do
        expect(page).to have_current_path("/m/#{map.private_id}?f=#{polygon.id}")
      end

      it 'can raw update feature' do
        find('#edit-button-edit').click
        sleep(0.3) # edit triggers modal pull-up
        find('#button-edit-raw').click
        expect(page).to have_selector('textarea[name="properties"]')
        fill_in 'properties', with: '{"title": "TEST"}'
        find('.feature-update').click
        wait_for { polygon.reload.properties['title'] }.to eq('TEST')
      end

      it 'can delete feature' do
        accept_alert do
          find('#edit-button-trash').click
        end
        expect(page).to have_text("Feature deleted")
        # need to wait until feature is saved server side
        wait_for { Feature.count }.to eq(0)
      end

      it 'shows feature meta data' do
        find('#edit-button-edit').click
        expect(page).to have_text('27.64 km²')
      end
    end
  end

  context 'with point on map' do
    let(:point) { create(:feature, :point_middle, title: 'Point Title') }
    let(:map) { create(:map, features: [ point ]) }

    context 'with selected point feature' do
      before do
        click_coord('#maplibre-map', 50, 50)
        find('#edit-button-edit').click
      end

      it 'can update point size' do
        find('#point-size').set(15)
        expect(page).to have_selector('#point-size-val', text: '15')
        expect(point.reload.properties['marker-size']).to eq('15')
      end

      it 'can update title' do
        fill_in 'feature-title', with: "New Title"
        wait_for { point.reload.properties['title'] }.to eq('New Title')
      end

      it 'can update label' do
        expect(page).not_to have_selector('#feature-label')
        click_button 'Add label'
        expect(page).to have_selector('#feature-label')
        fill_in 'feature-label', with: "New Label"
        wait_for { point.reload.properties['label'] }.to eq('New Label')
      end

      it 'can update desc' do
        expect(page).not_to have_selector('#feature-desc-input')
        click_button 'Add description'
        expect(page).to have_text('Add a description text')
        text_area = find(:css, '.CodeMirror textarea', visible: false)
        text_area.set('New Desc')
        wait_for { point.reload.properties['desc'] }.to eq('New Desc')
      end

      it 'can update fill color' do
        find('#fill-color').set('#aabbcc')
        wait_for { point.reload.properties['marker-color'] }.to eq('#aabbcc')
      end

      it 'can set fill color transparent' do
        expect(find('#fill-color-transparent')).not_to be_checked

        # TODO: did not find a better solution to check the box and trigger stimulus
        js = "document.getElementById('fill-color-transparent')"
        page.driver.execute_script("#{js}.checked = true")
        page.driver.execute_script("#{js}.dispatchEvent(new Event('input'))")
        page.driver.execute_script("#{js}.dispatchEvent(new Event('change'))")

        wait_for { point.reload.properties['marker-color'] }.to eq('transparent')
      end

      it 'can update outline color' do
        find('#stroke-color').set('#aabbcc')
        wait_for { point.reload.properties['stroke'] }.to eq('#aabbcc')
      end

      it 'can upload image' do
        image_path = Rails.root.join('spec', 'fixtures', 'files', 'mapforge-logo-icon.png')
        expect(page).to have_selector('#marker-image')
        attach_file('marker-image', image_path)

        wait_for { point.reload.properties['marker-image-url'] }.to match(/icon\/.+/)
        wait_for { point.reload.image&.public_id }.to match (/mapforge-logo-icon-\d+.png/)
      end

      it 'can upload image bigger 1024px' do
        image_path = Rails.root.join('spec', 'fixtures', 'files', 'image_large.jpg')
        expect(page).to have_selector('#marker-image')
        attach_file('marker-image', image_path)

        wait_for { point.reload.properties['marker-image-url'] }.to match(/icon\/.+/)
      end

      it 'can use emoji selector' do
        find('#marker-symbol-select').click
        expect(page).to have_selector('em-emoji-picker')

        # Cannot select in shadow dom wiht capybara
        shadow_host = find('em-emoji-picker')
        page.execute_script(<<~JS, shadow_host)
          const host = arguments[0];
          const shadow = host.shadowRoot;
          if (shadow) {
            const el = shadow.querySelector('span.emoji-mart-emoji'); // Replace selector
            el.click();
          }
        JS

        wait_for { point.reload.properties['marker-symbol'] }.to match('👍')
      end
    end
  end

  context 'with lost websocket' do
    it 'disables edit buttons' do
      ActionCable.server.connections.each(&:close)
      expect(page).to have_css('.mapbox-gl-draw_ctrl-draw-btn[disabled]')
    end
  end
end
