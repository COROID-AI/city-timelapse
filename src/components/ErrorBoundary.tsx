import { Component, ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WebGL Error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: 'white',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h4" gutterBottom>
            WebGL Initialization Error
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Unable to initialize 3D rendering. Please ensure your browser supports WebGL2.
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
            {this.state.error?.message}
          </Typography>
          <Button variant="contained" onClick={this.handleReset}>
            Retry
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}