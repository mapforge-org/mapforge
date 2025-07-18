require 'rails_helper'

RSpec.describe Mapforge::OsmcSymbolGenerator do
  describe '.generate' do
    it 'generates an image from a valid osmc symbol code' do
      result = described_class.generate('red:red:red_rectangle:11:white')
      result_content = File.read(result.tempfile)
      result_content = result_content[0..result_content.index("tIME")]
      expected_content = File.read(Rails.root.join('spec', 'fixtures', 'files', 'red_red_red_rectangle_11_white.png'))
      expected_content = expected_content[0..expected_content.index("tIME")]

      expect(result_content).to eq(expected_content)
    end

    it 'returns nil if the background image does not exist' do
      result = described_class.generate('blue:circle:red_dot:1:white')

      expect(result).to be_nil
    end

    it 'raises an error for invalid background filename' do
      expect {
        described_class.generate('blue:invalid/circle:red_dot:1:white')
      }.to raise_error(ActionController::BadRequest, /Invalid background filename/)
    end

    it 'raises an error for invalid foreground filename' do
      expect {
        described_class.generate('blue:circle:invalid/dot:1:white')
      }.to raise_error(ActionController::BadRequest, /Invalid foreground filename/)
    end

    it 'skips foreground when empty' do
      expect(described_class.generate('blue:blue::1:white')).to be_a(MiniMagick::Image)
    end

    it 'skips foreground when not present' do
      expect(described_class.generate('blue:blue:1:white')).to be_a(MiniMagick::Image)
    end
  end
end
