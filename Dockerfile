FROM ghcr.io/mapforge-org/mapforge-base:latest

LABEL org.opencontainers.image.description="Web container for Mapforge"
LABEL org.opencontainers.image.source="https://github.com/mapforge-org/mapforge"
LABEL org.opencontainers.image.licenses="MIT"

# Rails app lives here
WORKDIR /rails

# Set production environment
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"

# Install application gems
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

# Install JavaScript dependencies (we only have npm dev dependencies)
# COPY package.json package-lock.json ./
# RUN npm install --omit=dev

# Copy application code
COPY . .

# Precompile bootsnap code for faster boot times
RUN bundle exec bootsnap precompile app/ lib/

# Precompiling assets for production without requiring secret RAILS_MASTER_KEY
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Run and own only the runtime files as a non-root user for security
RUN useradd rails --create-home --shell /bin/bash && \
    chown -R rails:rails db log storage tmp
USER rails:rails

# Entrypoint prepares the database.
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --connect-timeout 5 --max-time 5 -f http://localhost:3000/up > /tmp/healthcheck.log 2>&1 || exit 1

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD ["./bin/thrust", "rails", "server"]
